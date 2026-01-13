import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"
import { getSessionUser } from "@/lib/auth-server"

interface WebhookPayload {
    job_id: string
    report_id: string
    tenant_id: string
    project_id: string
    status: string
    timestamp: string
    parsed_data?: Record<string, any>
    fraud_detection?: Record<string, any>
    [key: string]: any
}

// Helper: Safely convert any value to string
function safeStringify(value: any): string {
    if (value === null || value === undefined) return ""
    if (typeof value === "string") return value
    if (typeof value === "object") {
        if (Array.isArray(value)) {
            return value.map(v => safeStringify(v)).join(", ")
        }
        if (value.mr_no) return String(value.mr_no)
        if (value.reg_no) return String(value.reg_no)
        if (value.question && value.answer) return `Q: ${value.question}\nA: ${value.answer}`
        return JSON.stringify(value)
    }
    return String(value)
}

function mapParsedDataToStructured(parsedData: any) {
    if (!parsedData) return {}

    const getPatientId = (patientIdField: any): string => {
        if (!patientIdField) return ""
        if (typeof patientIdField === "string") return patientIdField
        if (typeof patientIdField === "object") {
            return patientIdField.mr_no || patientIdField.reg_no || ""
        }
        return String(patientIdField)
    }

    const labResults: { test: any; measuredValue: any; unit: any; referenceRange: any; status: any; notes: null }[] = []
    if (parsedData.lab_results && Array.isArray(parsedData.lab_results)) {
        parsedData.lab_results.forEach((exam: any) => {
            if (exam.tests && Array.isArray(exam.tests)) {
                exam.tests.forEach((test: any) => {
                    labResults.push({
                        test: test.test_name,
                        measuredValue: test.result,
                        unit: test.unit,
                        referenceRange: test.reference_range,
                        status: test.status,
                        notes: null,
                    })
                })
            }
        })
    }

    return {
        patientInfo: {
            fullName: parsedData.patient_name || "",
            name: parsedData.patient_name || "",
            dateOfBirth: null,
            age: null,
            gender: null,
            medicalRecordNumber: getPatientId(parsedData.patient_id),
        },
        providerInfo: {
            hospitalName: null,
            department: null,
            doctorName: parsedData.clinician_name || "",
        },
        clinicalData: {
            diagnosis: parsedData.diagnosis || null,
            secondaryDiagnoses: [],
            medications: parsedData.medications || [],
            labResults: labResults,
            vitalSigns: extractVitalSigns(parsedData),
            procedures: parsedData.procedures || null,
            imagingFindings: parsedData.imaging_findings || null,
        },
        documentInfo: {
            type: "Medical Report",
            reportDate: parsedData.encounter_date || null,
        },
        documentSummary: buildDocumentSummary(parsedData),
    }
}

function extractVitalSigns(parsedData: any) {
    const vitalSigns: Record<string, any> = {}

    if (parsedData.lab_results && Array.isArray(parsedData.lab_results)) {
        parsedData.lab_results.forEach((exam: any) => {
            if (exam.examination_name === "Vitals and Body Composition" && exam.tests) {
                exam.tests.forEach((test: any) => {
                    const testName = test.test_name.toLowerCase()
                    if (testName.includes("blood pressure")) {
                        vitalSigns.bloodPressure = test.result
                    } else if (testName.includes("heart rate")) {
                        vitalSigns.heartRate = test.result
                    } else if (testName.includes("temperature")) {
                        vitalSigns.temperature = test.result
                    } else if (testName.includes("oxygen saturation")) {
                        vitalSigns.oxygenSaturation = test.result
                    }
                })
            }
        })
    }

    return vitalSigns
}

function buildDocumentSummary(parsedData: any): string {
    const lines: string[] = []
    if (parsedData.patient_name) lines.push(`Patient: ${parsedData.patient_name}`)
    if (parsedData.encounter_date) lines.push(`Encounter Date: ${parsedData.encounter_date}`)
    if (parsedData.clinician_name) lines.push(`Clinician: ${parsedData.clinician_name}`)
    if (parsedData.diagnosis) lines.push(`Diagnosis: ${parsedData.diagnosis}`)
    return lines.join("\n")
}

function extractFieldsFromParsedData(parsedData: any) {
    const fields: Array<{ label: string; value: string }> = []

    if (parsedData.patient_name) {
        fields.push({
            label: "Patient Name",
            value: safeStringify(parsedData.patient_name),
        })
    }

    if (parsedData.patient_id) {
        if (typeof parsedData.patient_id === "object") {
            if (parsedData.patient_id.mr_no) {
                fields.push({
                    label: "MR Number",
                    value: safeStringify(parsedData.patient_id.mr_no),
                })
            }
            if (parsedData.patient_id.reg_no) {
                fields.push({
                    label: "Registration Number",
                    value: safeStringify(parsedData.patient_id.reg_no),
                })
            }
        } else if (typeof parsedData.patient_id === "string") {
            fields.push({
                label: "Patient ID",
                value: safeStringify(parsedData.patient_id),
            })
        }
    }

    if (parsedData.encounter_date) {
        fields.push({
            label: "Encounter Date",
            value: safeStringify(parsedData.encounter_date),
        })
    }

    if (parsedData.clinician_name) {
        fields.push({
            label: "Clinician Name",
            value: safeStringify(parsedData.clinician_name),
        })
    }

    if (parsedData.lab_results && Array.isArray(parsedData.lab_results)) {
        parsedData.lab_results.forEach((exam: any) => {
            if (exam.tests && Array.isArray(exam.tests)) {
                exam.tests.forEach((test: any) => {
                    fields.push({
                        label: `${exam.examination_name} - ${test.test_name}`,
                        value: safeStringify(`${test.result} ${test.unit} (${test.status})`),
                    })
                })
            }
        })
    }

    return fields
}

export async function POST(request: NextRequest) {
    console.log("[WEBHOOK POST] ===== WEBHOOK RECEIVED =====")

    try {
        const payload: WebhookPayload = await request.json()

        console.log("[WEBHOOK POST] Payload:", {
            job_id: payload.job_id,
            status: payload.status,
            has_parsed_data: !!payload.parsed_data,
        })

        if (!payload.job_id) {
            console.error("[WEBHOOK POST] ❌ Missing job_id")
            return NextResponse.json(
                { error: "Invalid webhook payload - missing job_id" },
                { status: 400 }
            )
        }

        const db = await getDatabase()
        const webhookCollection = db.collection("webhook_responses")
        const documentsCollection = db.collection("documents")
        const jobCollection = db.collection("job_ids")

        // **FETCH USER EMAIL AND FILENAME FROM job_ids**
        let userEmail = "anonymous"
        let actualFileName = `Document_${payload.job_id}` // fallback
        const jobRecord = await jobCollection.findOne({ job_id: payload.job_id })
        if (jobRecord) {
            userEmail = jobRecord.user_email || "anonymous"
            actualFileName = jobRecord.file_name || actualFileName // Use actual filename
            console.log("[WEBHOOK POST] Found user_email from job record:", userEmail)
            console.log("[WEBHOOK POST] Found file_name from job record:", actualFileName)
        } else {
            console.warn("[WEBHOOK POST] ⚠️ Job record not found, using defaults")
        }

        // Store in webhook_responses
        const webhookRecord = {
            job_id: payload.job_id,
            report_id: payload.report_id,
            tenant_id: payload.tenant_id,
            project_id: payload.project_id,
            status: payload.status,
            timestamp: payload.timestamp,
            received_at: new Date(),
            processed: false,
            document_id: null,
            parsed_data: payload.parsed_data || null,
            fraud_detection: payload.fraud_detection || null,
        }

        const webhookResult = await webhookCollection.insertOne(webhookRecord)
        console.log("[WEBHOOK POST] ✅ Stored in webhook_responses")

        // **SAVE TO DOCUMENTS COLLECTION ONLY WHEN WEBHOOK HAS PARSED DATA (i.e., processing is complete)**
        if (payload.parsed_data && Object.keys(payload.parsed_data).length > 0) {
            console.log("[WEBHOOK POST] 💾 Saving to documents collection with user_email:", userEmail)

            const documentRecord = {
                job_id: payload.job_id,
                report_id: payload.report_id || payload.job_id,
                file_name: actualFileName, // Use actual filename instead of generating
                file_type: "medical_report",
                file_size: 0,
                document_type: "Medical Report",
                status: payload.status || "completed",
                user_email: userEmail,

                // Parsed and structured data
                parsed_data: payload.parsed_data,
                structured_data: mapParsedDataToStructured(payload.parsed_data),
                fields: extractFieldsFromParsedData(payload.parsed_data),

                // Metadata
                summary: buildDocumentSummary(payload.parsed_data),
                notes: [],
                confidence_score: 85,
                error_message: null,

                // Timestamps
                created_at: new Date(),
                updated_at: new Date(),
            }

            try {
                const docResult = await documentsCollection.insertOne(documentRecord)
                console.log("[WEBHOOK POST] ✅ Document saved:", docResult.insertedId, "for user:", userEmail)

                // Update webhook with document_id
                await webhookCollection.updateOne(
                    { _id: webhookResult.insertedId },
                    {
                        $set: {
                            document_id: docResult.insertedId.toString(),
                            processed: true,
                        }
                    }
                )
                console.log("[WEBHOOK POST] ✅ Webhook marked as processed")

                // **Update job_ids record with document_id and preserve filename**
                await jobCollection.updateOne(
                    { job_id: payload.job_id },
                    {
                        $set: {
                            status: payload.status || "completed",
                            document_id: docResult.insertedId.toString(),
                            parsed_data: payload.parsed_data,
                            updated_at: new Date(),
                        }
                    }
                )
                console.log("[WEBHOOK POST] ✅ Job ID record updated with document_id")

            } catch (docError) {
                console.error("[WEBHOOK POST] ❌ Error saving to documents:", docError)
            }
        }

        console.log("[WEBHOOK POST] ===== COMPLETE =====")

        // **RETURN RESPONSE WITH job_id**
        return NextResponse.json(
            {
                success: true,
                message: "Webhook processed successfully",
                job_id: payload.job_id,
                report_id: payload.report_id,
                status: payload.status,
                timestamp: new Date().toISOString(),
            },
            { status: 200 }
        )
    } catch (error) {
        console.error("[WEBHOOK POST] ❌ Error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed" },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    try {
        const db = await getDatabase()
        const webhookCollection = db.collection("webhook_responses")
        const jobCollection = db.collection("job_ids")

        const sessionUser = await getSessionUser(request)
        if (!sessionUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const jobId = request.nextUrl.searchParams.get("job_id")

        if (jobId) {
            const webhook = await webhookCollection.findOne({ job_id: jobId })
            if (!webhook) {
                return NextResponse.json({ error: "Not found" }, { status: 404 })
            }

            const job = await jobCollection.findOne({ job_id: jobId })
            if (job?.user_email !== sessionUser.email && !sessionUser.isAdmin) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
            }

            return NextResponse.json({
                success: true,
                webhook: {
                    id: webhook._id.toString(),
                    job_id: webhook.job_id,
                    report_id: webhook.report_id,
                    status: webhook.status,
                    parsed_data: webhook.parsed_data,
                    timestamp: webhook.timestamp,
                },
            })
        }

        const userFilter = sessionUser.isAdmin ? {} : { user_email: sessionUser.email }
        const recentWebhooks = await webhookCollection
            .find(userFilter)
            .sort({ received_at: -1 })
            .limit(20)
            .toArray()

        return NextResponse.json({
            success: true,
            webhooks: recentWebhooks.map((w: any) => ({
                id: w._id.toString(),
                job_id: w.job_id,
                report_id: w.report_id,
                status: w.status,
                timestamp: w.timestamp,
            })),
            count: recentWebhooks.length,
        })
    } catch (error) {
        console.error("[WEBHOOK GET] Error:", error)
        return NextResponse.json({ error: "Failed" }, { status: 500 })
    }
}

export async function migrateWebhookToDocuments(request: NextRequest) {
    console.log("[MIGRATE WEBHOOK] ===== MIGRATION STARTED =====")

    try {
        const db = await getDatabase()
        const webhookCollection = db.collection("webhook_responses")
        const documentsCollection = db.collection("documents")
        const jobCollection = db.collection("job_ids")

        const webhooksToMigrate = await webhookCollection.find({ processed: false }).toArray()
        console.log(`[MIGRATE WEBHOOK] Found ${webhooksToMigrate.length} webhooks to migrate`)

        for (const webhook of webhooksToMigrate) {
            console.log(`[MIGRATE WEBHOOK] Processing webhook ID: ${webhook._id}`)

            // Skip if no parsed_data
            if (!webhook.parsed_data || Object.keys(webhook.parsed_data).length === 0) {
                console.log("[MIGRATE WEBHOOK] No parsed_data, skipping...")
                continue
            }

            // **FETCH USER EMAIL FROM job_ids**
            let userEmail = "anonymous"
            const jobRecord = await jobCollection.findOne({ job_id: webhook.job_id })
            if (jobRecord) {
                userEmail = jobRecord.user_email || "anonymous"
                console.log("[MIGRATE WEBHOOK] Found user_email:", userEmail)
            }

            const documentRecord = {
                job_id: webhook.job_id,
                report_id: webhook.report_id || webhook.job_id,
                file_name: `Document_${webhook.job_id}`,
                file_type: "medical_report",
                file_size: 0,
                document_type: "Medical Report",
                status: webhook.status || "completed",
                user_email: userEmail,

                // Parsed and structured data
                parsed_data: webhook.parsed_data,
                structured_data: mapParsedDataToStructured(webhook.parsed_data),
                fields: extractFieldsFromParsedData(webhook.parsed_data),

                // Metadata
                summary: buildDocumentSummary(webhook.parsed_data),
                notes: [],
                confidence_score: 85,
                error_message: null,

                // Timestamps
                created_at: new Date(),
                updated_at: new Date(),
            }

            try {
                const docResult = await documentsCollection.insertOne(documentRecord)
                console.log("[MIGRATE WEBHOOK] ✅ Document saved with ID:", docResult.insertedId, "for user:", userEmail)

                // Update webhook as processed
                await webhookCollection.updateOne(
                    { _id: webhook._id },
                    {
                        $set: {
                            processed: true,
                            document_id: docResult.insertedId.toString(),
                        }
                    }
                )
                console.log("[MIGRATE WEBHOOK] ✅ Webhook marked as processed")

                // **NEW: Create job_ids record during migration too**
                const jobIdRecord = {
                    job_id: webhook.job_id,
                    report_id: webhook.report_id || webhook.job_id,
                    file_name: `Document_${webhook.job_id}`,
                    document_type: "Medical Report",
                    status: webhook.status || "completed",
                    user_email: userEmail,
                    document_id: docResult.insertedId.toString(),
                    created_at: new Date(),
                    updated_at: new Date(),
                }

                await jobCollection.updateOne(
                    { job_id: webhook.job_id },
                    { $set: jobIdRecord },
                    { upsert: true }
                )
                console.log("[MIGRATE WEBHOOK] ✅ Job ID record created in job_ids collection")
            } catch (docError) {
                console.error("[MIGRATE WEBHOOK] ❌ Error saving document:", docError)
            }
        }

        console.log("[MIGRATE WEBHOOK] ===== MIGRATION COMPLETE =====")

        return NextResponse.json(
            {
                success: true,
                message: `Migration complete. Processed ${webhooksToMigrate.length} webhooks.`,
            },
            { status: 200 }
        )
    } catch (error) {
        console.error("[MIGRATE WEBHOOK] ❌ Error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Migration failed" },
            { status: 500 }
        )
    }
}