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

// ✅ UPDATED: Helper to emit WebSocket event
async function emitDocumentStatusUpdate(
    documentId: string,
    status: "pending" | "processing" | "completed" | "failed",
    error?: string,
) {
    try {
        const statusPort = process.env.STATUS_UPDATE_PORT || 3002;
        const statusUpdateUrl = process.env.SOCKET_STATUS_URL || `http://localhost:${statusPort}/emit-status`;
        
        console.log(`[WEBHOOK] 📡 Sending status update to ${statusUpdateUrl}: ${documentId} -> ${status}`);

        const response = await fetch(statusUpdateUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId, status, error }),
        });

        if (!response.ok) {
            console.warn(`[WEBHOOK] ⚠️ Status update failed: ${response.status}`);
        } else {
            console.log(`[WEBHOOK] ✅ Status update sent successfully`);
        }
    } catch (err) {
        console.error("[WEBHOOK] Error emitting status update:", err);
    }
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

        let userEmail = "anonymous"
        let actualFileName = `Document_${payload.job_id}`
        let documentId: string | null = null

        const jobRecord = await jobCollection.findOne({ job_id: payload.job_id })
        if (jobRecord) {
            userEmail = jobRecord.user_email || "anonymous"
            actualFileName = jobRecord.file_name || actualFileName
            documentId = jobRecord.document_id
            console.log("[WEBHOOK POST] Found job record for user:", userEmail)
        } else {
            console.warn("[WEBHOOK POST] ⚠️ Job record not found")
        }

        const fraudDetection = payload.fraud_detection !== undefined
            ? payload.fraud_detection
            : (payload.parsed_data?.fraud_detection || null)

        console.log("[WEBHOOK POST] Extracted fraud_detection:", !!fraudDetection)

        const webhookRecord = {
            job_id: payload.job_id,
            report_id: payload.report_id,
            tenant_id: payload.tenant_id,
            project_id: payload.project_id,
            status: payload.status,
            timestamp: payload.timestamp,
            received_at: new Date(),
            processed: false,
            document_id: documentId,
            parsed_data: payload.parsed_data || null,
            fraud_detection: fraudDetection,
        }

        const webhookResult = await webhookCollection.insertOne(webhookRecord)
        console.log("[WEBHOOK POST] ✅ Stored webhook response")

        // ✅ NEW: Emit processing status update
        if (documentId) {
            console.log(`[WEBHOOK POST] Emitting processing status for ${documentId}`)
            await emitDocumentStatusUpdate(documentId, "processing")
        }

        // **SAVE TO DOCUMENTS COLLECTION WHEN WEBHOOK HAS PARSED DATA**
        if (payload.parsed_data && Object.keys(payload.parsed_data).length > 0) {
            console.log("[WEBHOOK POST] 💾 Saving to documents collection")

            const enrichedParsedData = {
                ...payload.parsed_data,
                fraud_detection: fraudDetection,
            }

            const documentRecord = {
                job_id: payload.job_id,
                report_id: payload.report_id || payload.job_id,
                file_name: actualFileName,
                file_type: "medical_report",
                file_size: 0,
                document_type: "Medical Report",
                status: "completed",
                user_email: userEmail,
                parsed_data: enrichedParsedData,
                structured_data: mapParsedDataToStructured(enrichedParsedData, fraudDetection),
                fields: extractFieldsFromParsedData(enrichedParsedData),
                fraud_detection: fraudDetection,
                summary: buildDocumentSummary(enrichedParsedData),
                notes: [],
                confidence_score: 85,
                error_message: null,
                created_at: new Date(),
                updated_at: new Date(),
            }

            try {
                const docResult = await documentsCollection.insertOne(documentRecord)
                documentId = docResult.insertedId.toString()
                console.log("[WEBHOOK POST] ✅ Document saved:", documentId)

                // ✅ NEW: Emit completion status
                await emitDocumentStatusUpdate(documentId, "completed")

                // Update webhook
                await webhookCollection.updateOne(
                    { _id: webhookResult.insertedId },
                    {
                        $set: {
                            document_id: documentId,
                            processed: true,
                        }
                    }
                )

                // Update job record
                await jobCollection.updateOne(
                    { job_id: payload.job_id },
                    {
                        $set: {
                            status: "completed",
                            document_id: documentId,
                            parsed_data: enrichedParsedData,
                            fraud_detection: fraudDetection,
                            updated_at: new Date(),
                        }
                    }
                )
                console.log("[WEBHOOK POST] ✅ Job record updated")

            } catch (docError) {
                console.error("[WEBHOOK POST] ❌ Error saving document:", docError)
                await emitDocumentStatusUpdate(documentId || "", "failed", "Database error")
            }
        }

        console.log("[WEBHOOK POST] ===== COMPLETE =====")

        // **RETURN RESPONSE WITH job_id**
        return NextResponse.json(
            {
                success: true,
                message: "Webhook processed successfully",
                job_id: payload.job_id,
                document_id: documentId,
                status: "completed",
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