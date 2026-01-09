import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"

interface HistoryDocument {
    id: string
    file_name: string
    created_at: string
    structured_data: any
    job_id?: string
    report_id?: string
    user_email?: string
    user_name?: string
    document_type?: string
    status?: string
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
        const jobCollection = db.collection("job_ids")

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

        // Fetch from both collections
        const [documents, jobRecords] = await Promise.all([
            documentsCollection
                .find(userFilter)
                .sort({ created_at: -1 })
                .limit(limit)
                .toArray(),
            jobCollection
                .find(userFilter)
                .sort({ created_at: -1 })
                .limit(limit)
                .toArray(),
        ])

        console.log(
            "[RECENT-DOCUMENTS]",
            "Found:",
            documents.length,
            "documents,",
            jobRecords.length,
            "jobs"
        )

        // Combine and deduplicate
        const allRecords = [
            ...documents,
            ...jobRecords,
        ]

        // Sort by created_at and remove duplicates
        const seen = new Set()
        const uniqueRecords = allRecords
            .sort((a: any, b: any) => {
                const dateA = new Date(a.created_at || a.uploaded_at || a.timestamp || new Date()).getTime()
                const dateB = new Date(b.created_at || b.uploaded_at || b.timestamp || new Date()).getTime()
                return dateB - dateA
            })
            .filter((doc: any) => {
                const key = doc.job_id || doc._id?.toString()
                if (seen.has(key)) return false
                seen.add(key)
                return true
            })
            .slice(0, limit)

        // Debug: Log document details
        uniqueRecords.forEach((doc: any, idx: number) => {
            console.log(`[RECENT-DOCUMENTS] Doc ${idx + 1}:`, {
                file_name: doc.file_name,
                user_email: doc.user_email,
                created_at: doc.created_at,
                job_id: doc.job_id,
                status: doc.status,
            })
        })

        // Map documents
        const mappedDocuments: HistoryDocument[] = uniqueRecords.map((doc: any) => ({
            id: doc._id?.toString() || doc.job_id || "",
            file_name: doc.file_name || "document",
            created_at: (doc.created_at || doc.uploaded_at || doc.timestamp || new Date()).toString().includes("T")
                ? doc.created_at || doc.uploaded_at || doc.timestamp || new Date().toISOString()
                : new Date(doc.created_at || doc.uploaded_at || doc.timestamp || new Date()).toISOString(),
            structured_data: doc.parsed_data
                ? mapParsedDataToStructured(doc.parsed_data)
                : doc.structured_data || {},
            job_id: doc.job_id,
            report_id: doc.report_id,
            user_email: doc.user_email,
            user_name: doc.user_name,
            document_type: doc.document_type || "Medical Document",
            status: doc.status || "completed",
        }))

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