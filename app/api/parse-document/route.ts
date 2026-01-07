import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"
import { uploadDocumentToYira } from "@/lib/parse-wrapper"
import { ObjectId } from "mongodb"

export const runtime = "nodejs"
export const maxDuration = 300
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
    console.log("[UPLOAD] Document upload request received")

    try {
        const sessionUser = await getSessionUser(request)
        if (!sessionUser) {
            return NextResponse.json(
                { error: "Unauthorized: Please log in" },
                { status: 401 }
            )
        }

        const db = await getDatabase()
        const accountsCollection = db.collection("accounts")

        const formData = await request.formData()
        const files = formData.getAll("files") as File[]
        const originalFileName = formData.get("originalFileName") as string

        if (!files || files.length === 0) {
            console.log("[UPLOAD] ERROR: No files provided")
            return NextResponse.json({ error: "No files provided" }, { status: 400 })
        }

        console.log("[UPLOAD] Files received:", files.length)

        // Check user's upload limit
        const account = await accountsCollection.findOne({ email: sessionUser.email })
        if (!account) {
            return NextResponse.json(
                { error: "Account not found" },
                { status: 404 }
            )
        }

        // If user role is not admin, check upload limit
        if (account.role === "user" && account.upload_limit !== null) {
            if (account.upload_count >= account.upload_limit) {
                return NextResponse.json(
                    { error: `Upload limit (${account.upload_limit}) reached` },
                    { status: 429 }
                )
            }
        }

        const uploadedDocuments = []

        // Process each file using the wrapper
        for (const file of files) {
            console.log("[UPLOAD] Processing file:", file.name)

            const result = await uploadDocumentToYira(file, sessionUser.email, originalFileName)

            if (result.success) {
                uploadedDocuments.push({
                    id: result.documentId,
                    file_name: originalFileName,
                    file_size: file.size,
                    job_id: result.job_id,
                    report_id: result.report_id,
                    status: "processing",
                })
            } else {
                uploadedDocuments.push({
                    id: undefined,
                    file_name: originalFileName,
                    file_size: file.size,
                    status: "failed",
                    error: result.error,
                })
            }
        }

        // Update account upload count
        if (account.role === "user") {
            await accountsCollection.updateOne(
                { email: sessionUser.email },
                { $inc: { upload_count: files.length } }
            )
            console.log("[UPLOAD] Updated upload count for:", sessionUser.email)
        }

        // Log upload activity
        const historyCollection = db.collection("upload_history")
        await historyCollection.insertOne({
            user_email: sessionUser.email,
            action: "upload",
            document_ids: uploadedDocuments
                .filter((d) => d.id)
                .map((d) => new ObjectId(d.id)),
            details: {
                file_count: files.length,
                total_size: files.reduce((sum, f) => sum + f.size, 0),
            },
            created_at: new Date(),
        })

        return NextResponse.json(
            {
                success: true,
                documents: uploadedDocuments,
                filesProcessed: files.length,
                message: "Document(s) sent for processing",
            },
            { status: 201 }
        )
    } catch (error) {
        console.error("[UPLOAD] ERROR:", error)
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown error occurred",
            },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    console.log("[UPLOAD] Document retrieval request")

    try {
        const id = request.nextUrl.searchParams.get("id")

        if (!id) {
            return NextResponse.json(
                { error: "No document ID provided" },
                { status: 400 }
            )
        }

        const db = await getDatabase()
        const documentsCollection = db.collection("documents")
        const jobCollection = db.collection("job_ids")

        let document = null
        let isJobRecord = false

        // First try to find in documents collection
        try {
            document = await documentsCollection.findOne({
                _id: new ObjectId(id),
            })
        } catch (e) {
            console.log("[UPLOAD] Invalid ObjectId format for documents collection")
        }

        // If not found, try job_ids collection
        if (!document) {
            try {
                document = await jobCollection.findOne({
                    _id: new ObjectId(id),
                })
                isJobRecord = true
                console.log("[UPLOAD] Found job record:", id)
            } catch (e) {
                console.log("[UPLOAD] Invalid ObjectId format for job_ids collection")
            }
        }

        if (!document) {
            console.log("[UPLOAD] Document not found with id:", id)
            return NextResponse.json(
                { error: "Document not found" },
                { status: 404 }
            )
        }

        // Map job record or document record to response format
        if (isJobRecord) {
            return NextResponse.json({
                success: true,
                id: document._id.toString(),
                fileName: document.file_name,
                fileType: "unknown",
                fileSize: 0,
                status: document.status,
                uploadedAt: document.created_at,
                jobId: document.job_id,
                reportId: document.report_id,
                parsedData: document.parsed_data,
                structuredData: document.parsed_data ? mapParsedDataToStructured(document.parsed_data) : {},
                errorMessage: null,
            })
        }

        // Document collection format
        return NextResponse.json({
            success: true,
            id: document._id.toString(),
            fileName: document.file_name,
            fileType: document.file_type,
            fileSize: document.file_size,
            status: document.status,
            uploadedAt: document.created_at,
            parsedData: document.parsed_data,
            structuredData: document.structured_data,
            jobId: document.job_id,
            reportId: document.report_id,
            errorMessage: document.error_message,
        })
    } catch (error) {
        console.error("[UPLOAD] Error retrieving document:", error)
        return NextResponse.json(
            { error: "Failed to retrieve document" },
            { status: 500 }
        )
    }
}

// Helper function to map parsed_data to structured format
function mapParsedDataToStructured(parsedData: any) {
    if (!parsedData) return {}

    return {
        patient_name: parsedData.patient_name,
        patient_id: parsedData.patient_id,
        encounter_date: parsedData.encounter_date,
        clinician_name: parsedData.clinician_name,
        lab_results: parsedData.lab_results || [],
        diagnosis: parsedData.diagnosis,
        medications: parsedData.medications,
        procedures: parsedData.procedures,
        imaging_findings: parsedData.imaging_findings,
        recommendations: parsedData.recommendations,
    }
}