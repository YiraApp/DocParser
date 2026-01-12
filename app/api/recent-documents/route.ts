import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"
import { ObjectId } from "mongodb"

interface HistoryDocument {
    id: string
    file_name: string
    file_type?: string
    file_size?: number
    created_at: string
    structured_data: any
    status?: string
    user_email?: string
    user_name?: string
    document_type?: string
    job_id?: string
    report_id?: string
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const limit = Math.min(Number.parseInt(searchParams.get("limit") || "5"), 100)

        // Get session user
        const sessionUser = await getSessionUser(request)
        if (!sessionUser) {
            return NextResponse.json({ documents: [] })
        }

        const db = await getDatabase()
        const documentsCollection = db.collection("documents")
        const webhookCollection = db.collection("webhook_responses")

        // Build user filter - admins see all, users see only their own
        const userFilter = sessionUser.isAdmin
            ? {}
            : { user_email: sessionUser.email }

        console.log(
            "[RECENT-DOCUMENTS]",
            "User:",
            sessionUser.email,
            "IsAdmin:",
            sessionUser.isAdmin,
            "Filter:",
            JSON.stringify(userFilter),
        )

        // Fetch from webhook_responses (most recent) - job_id based
        const webhookRecords = await webhookCollection
            .find(userFilter)
            .sort({ received_at: -1 })
            .limit(limit)
            .toArray()

        console.log(
            "[RECENT-DOCUMENTS]",
            "Found:",
            webhookRecords.length,
            "webhook records"
        )

        // Map webhook records to documents by fetching full document data
        const mappedDocuments: HistoryDocument[] = []

        for (const webhook of webhookRecords) {
            // Try to fetch the full document from documents collection
            let fullDocument = null

            if (webhook.job_id) {
                fullDocument = await documentsCollection.findOne({ job_id: webhook.job_id })
            }

            // If found in documents collection, use that data; otherwise use webhook data
            if (fullDocument) {
                mappedDocuments.push({
                    id: fullDocument._id?.toString() || webhook.job_id || "",
                    file_name: fullDocument.file_name,
                    file_type: fullDocument.file_type,
                    file_size: fullDocument.file_size,
                    created_at: fullDocument.created_at,
                    structured_data: fullDocument.structured_data,
                    status: fullDocument.status,
                    user_email: fullDocument.user_email,
                    user_name: fullDocument.user_email?.split("@")[0] || "Unknown",
                    document_type: fullDocument.document_type,
                    job_id: webhook.job_id,
                    report_id: webhook.report_id,
                })
            } else {
                // Fallback to webhook data if document not found
                mappedDocuments.push({
                    id: webhook._id?.toString() || webhook.job_id || "",
                    file_name: webhook.file_name || `Document_${webhook.job_id}`,
                    file_type: "medical_report",
                    file_size: 0,
                    created_at: (webhook.received_at || webhook.timestamp || new Date()).toString().includes("T")
                        ? (webhook.received_at || webhook.timestamp || new Date()).toISOString()
                        : new Date(webhook.received_at || webhook.timestamp || new Date()).toISOString(),
                    structured_data: webhook.parsed_data
                        ? mapParsedDataToStructured(webhook.parsed_data)
                        : {},
                    status: webhook.status || "completed",
                    user_email: webhook.user_email,
                    user_name: webhook.user_email?.split("@")[0] || "Unknown",
                    document_type: "Medical Report",
                    job_id: webhook.job_id,
                    report_id: webhook.report_id,
                })
            }
        }

        // Debug: Log document details
        mappedDocuments.forEach((doc: any, idx: number) => {
            console.log(`[RECENT-DOCUMENTS] Doc ${idx + 1}:`, {
                file_name: doc.file_name,
                user_email: doc.user_email,
                created_at: doc.created_at,
                job_id: doc.job_id,
                status: doc.status,
            })
        })

        return NextResponse.json({ documents: mappedDocuments })
    } catch (error) {
        console.error("[RECENT-DOCUMENTS] Error:", error)
        return NextResponse.json({ documents: [] })
    }
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

    const labResults: any[] = []
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
            medicalRecordNumber: getPatientId(parsedData.patient_id),
        },
        providerInfo: {
            doctorName: parsedData.clinician_name || "",
        },
        clinicalData: {
            labResults: labResults,
        },
        documentInfo: {
            type: "Medical Report",
            reportDate: parsedData.encounter_date || null,
        },
    }
}