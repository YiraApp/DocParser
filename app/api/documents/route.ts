import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"

export async function GET(request: NextRequest) {
    try {
        const sessionUser = await getSessionUser(request)
        if (!sessionUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const jobId = request.nextUrl.searchParams.get("job_id")

        const db = await getDatabase()
        const documentsCollection = db.collection("documents")

        if (jobId) {
            // Fetch by job_id
            const document = await documentsCollection.findOne({
                job_id: jobId,
                user_email: sessionUser.email
            })

            if (!document) {
                return NextResponse.json(
                    { document: null },
                    { status: 200 }
                )
            }

            return NextResponse.json({
                document: {
                    _id: document._id.toString(),
                    file_name: document.file_name,
                    file_url: document.file_url || null,
                    created_at: document.created_at,
                    document_type: document.document_type,
                    fields: document.fields || [],
                    summary: document.summary || "",
                    notes: document.notes || [],
                    structured_data: document.structured_data || {},
                    confidence_score: document.confidence_score || 85,
                    health_recommendations: document.health_recommendations || null,
                    fraud_detection: document.fraud_detection || null,
                }
            })
        }

        // Fetch all documents for user (existing functionality)
        const documents = await documentsCollection
            .find({ user_email: sessionUser.email })
            .sort({ created_at: -1 })
            .limit(50)
            .toArray()

        return NextResponse.json({
            documents: documents.map((doc: any) => ({
                _id: doc._id.toString(),
                file_name: doc.file_name,
                file_url: doc.file_url || null,
                created_at: doc.created_at,
                document_type: doc.document_type,
                fields: doc.fields || [],
                summary: doc.summary || "",
                notes: doc.notes || [],
                structured_data: doc.structured_data || {},
                confidence_score: doc.confidence_score || 85,
                fraud_detection: doc.fraud_detection || null,
            }))
        })
    } catch (error) {
        console.error("[DOCUMENTS GET] Error:", error)
        return NextResponse.json(
            { error: "Failed to fetch documents" },
            { status: 500 }
        )
    }
}