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

function mapParsedDataToStructured(parsedData: any, fraudDetection: any = null) {
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
        // Add medical history questions
        medicalHistoryQuestions: parsedData.medical_history_questions || [],
        // Preserve photo comparison data
        photoComparison: parsedData.photo_comparison || null,
        // ✅ Explicitly use the fraud_detection parameter passed to function
        fraudDetection: fraudDetection !== null ? fraudDetection : (parsedData.fraud_detection || null),
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
            has_fraud_detection: !!payload.fraud_detection,
            has_fraud_detection_in_parsed: !!payload.parsed_data?.fraud_detection,
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

        // ✅ Extract fraud_detection with explicit null check
        const fraudDetection = payload.fraud_detection !== undefined 
            ? payload.fraud_detection 
            : (payload.parsed_data?.fraud_detection || null)

        console.log("[WEBHOOK POST] Extracted fraud_detection:", fraudDetection)

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
            fraud_detection: fraudDetection,
        }

        const webhookResult = await webhookCollection.insertOne(webhookRecord)
        console.log("[WEBHOOK POST] ✅ Stored in webhook_responses with fraud_detection:", !!fraudDetection)

        // **SAVE TO DOCUMENTS COLLECTION ONLY WHEN WEBHOOK HAS PARSED DATA (i.e., processing is complete)**
        if (payload.parsed_data && Object.keys(payload.parsed_data).length > 0) {
            console.log("[WEBHOOK POST] 💾 Saving to documents collection with user_email:", userEmail)

            // ✅ Merge fraud_detection into parsed_data
            const enrichedParsedData = {
                ...payload.parsed_data,
                fraud_detection: fraudDetection,
            }

            const documentRecord = {
                job_id: payload.job_id,
                report_id: payload.report_id || payload.job_id,
                file_name: actualFileName, // Use actual filename instead of generating
                file_type: "medical_report",
                file_size: 0,
                document_type: "Medical Report",
                status: payload.status || "completed",
                user_email: userEmail,

                // ✅ Use enriched parsed_data with fraud_detection included
                parsed_data: enrichedParsedData,
                // ✅ Pass fraudDetection as second parameter to mapParsedDataToStructured
                structured_data: mapParsedDataToStructured(enrichedParsedData, fraudDetection),
                fields: extractFieldsFromParsedData(enrichedParsedData),

                // ✅ Add fraud_detection field here
                fraud_detection: fraudDetection,

                // Metadata
                summary: buildDocumentSummary(enrichedParsedData),
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
                console.log("[WEBHOOK POST] 💾 Fraud detection in structured_data:", documentRecord.structured_data.fraudDetection)

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
                            parsed_data: enrichedParsedData,
                            fraud_detection: fraudDetection,
                            updated_at: new Date(),
                        }
                    }
                )
                console.log("[WEBHOOK POST] ✅ Job ID record updated with document_id and fraud_detection")

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
                    fraud_detection: webhook.fraud_detection || null,
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
                fraud_detection: w.fraud_detection || null,
                timestamp: w.timestamp,
            })),
            count: recentWebhooks.length,
        })
    } catch (error) {
        console.error("[WEBHOOK GET] Error:", error)
        return NextResponse.json({ error: "Failed" }, { status: 500 })
    }
}