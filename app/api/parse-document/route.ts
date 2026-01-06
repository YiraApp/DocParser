import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"
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
        const documentsCollection = db.collection("documents")
        const accountsCollection = db.collection("accounts")

        const formData = await request.formData()
        const files = formData.getAll("files") as File[]
        const originalFileName = formData.get("originalFileName") as string

        if (!files || files.length === 0) {
            console.log("[UPLOAD] ERROR: No files provided")
            return NextResponse.json({ error: "No files provided" }, { status: 400 })
        }

        console.log("[UPLOAD] Files received:", files.length)

        // Validate file types
        const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"]
        for (const file of files) {
            if (!allowedTypes.includes(file.type)) {
                return NextResponse.json(
                    { error: "Only PNG, JPG, JPEG, and PDF files are supported" },
                    { status: 400 }
                )
            }
        }

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

        // Process each file
        for (const file of files) {
            console.log("[UPLOAD] Processing file:", file.name)

            const buffer = await file.arrayBuffer()
            const base64Data = Buffer.from(buffer).toString("base64")

            // Create initial document record in MongoDB
            const documentRecord = {
                user_email: sessionUser.email,
                file_name: originalFileName,
                file_type: file.type,
                file_size: file.size,
                file_data: base64Data,
                status: "processing",
                created_at: new Date(),
                updated_at: new Date(),
                parsed_data: null,
                structured_data: null,
                webhook_processed: false,
                job_id: null,
                report_id: null,
                error_message: null,
            }

            const dbResult = await documentsCollection.insertOne(documentRecord)
            const documentId = dbResult.insertedId.toString()

            console.log("[UPLOAD] Document stored with ID:", documentId)

            // Call Yira API to parse the document
            const yiraApiUrl = process.env.YIRA_API_URL
            const yiraApiKey = process.env.YIRA_API_KEY
            const webhookUrl = process.env.WEBHOOK_URL || "http://localhost:3000/api/webhook"

            if (!yiraApiUrl || !yiraApiKey) {
                console.error("[UPLOAD] Missing Yira API credentials")
                await documentsCollection.updateOne(
                    { _id: new ObjectId(documentId) },
                    {
                        $set: {
                            status: "failed",
                            error_message: "Missing API credentials",
                            updated_at: new Date(),
                        },
                    }
                )
                return NextResponse.json(
                    { error: "API configuration error" },
                    { status: 500 }
                )
            }

            try {
                // Prepare form data for Yira API
                const yiraFormData = new FormData()
                yiraFormData.append("file", file)

                console.log("[UPLOAD] Calling Yira API:", yiraApiUrl)

                // Call Yira API with webhook URL
                const yiraResponse = await fetch(
                    `${yiraApiUrl}?webhook_url=${encodeURIComponent(webhookUrl)}`,
                    {
                        method: "POST",
                        headers: {
                            "X-API-Key": yiraApiKey,
                        },
                        body: yiraFormData,
                    }
                )

                console.log("[UPLOAD] Yira API response status:", yiraResponse.status)

                if (!yiraResponse.ok) {
                    const errorText = await yiraResponse.text()
                    console.error("[UPLOAD] Yira API error:", errorText)
                    throw new Error(`Yira API error: ${yiraResponse.statusText}`)
                }

                const yiraData = await yiraResponse.json()

                console.log("[UPLOAD] Yira API success:", yiraData)

                // Update document with job and report IDs
                await documentsCollection.updateOne(
                    { _id: new ObjectId(documentId) },
                    {
                        $set: {
                            job_id: yiraData.job_id,
                            report_id: yiraData.report_id,
                            status: "processing",
                            updated_at: new Date(),
                        },
                    }
                )

                uploadedDocuments.push({
                    id: documentId,
                    file_name: originalFileName,
                    file_size: file.size,
                    job_id: yiraData.job_id,
                    report_id: yiraData.report_id,
                    status: "processing",
                })
            } catch (apiError) {
                console.error("[UPLOAD] API call error:", apiError)

                // Update document with error
                await documentsCollection.updateOne(
                    { _id: new ObjectId(documentId) },
                    {
                        $set: {
                            status: "failed",
                            error_message: apiError instanceof Error ? apiError.message : "Unknown API error",
                            updated_at: new Date(),
                        },
                    }
                )

                uploadedDocuments.push({
                    id: documentId,
                    file_name: originalFileName,
                    file_size: file.size,
                    status: "failed",
                    error: apiError instanceof Error ? apiError.message : "Unknown error",
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
            document_ids: uploadedDocuments.map((d) => new ObjectId(d.id)),
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
        const sessionUser = await getSessionUser(request)
        if (!sessionUser) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const id = request.nextUrl.searchParams.get("id")

        if (!id) {
            return NextResponse.json(
                { error: "No document ID provided" },
                { status: 400 }
            )
        }

        const db = await getDatabase()
        const documentsCollection = db.collection("documents")

        const document = await documentsCollection.findOne({
            _id: new ObjectId(id),
            user_email: sessionUser.email,
        })

        if (!document) {
            return NextResponse.json(
                { error: "Document not found" },
                { status: 404 }
            )
        }

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