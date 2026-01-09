import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"

export async function GET(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get("id")
        
        if (!id) {
            return NextResponse.json(
                { error: "Missing document ID" },
                { status: 400 }
            )
        }

        const sessionUser = await getSessionUser(request)
        if (!sessionUser) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const db = await getDatabase()
        const documentsCollection = db.collection("documents")

        // Build query - search by job_id or _id
        const query: any = {
            $or: [
                { job_id: id },
                { _id: { $oid: id } }
            ]
        }

        // Add user filter if not admin
        if (!sessionUser.isAdmin) {
            query.user_email = sessionUser.email
        }

        console.log("[FETCH-DOCUMENT] Searching with query:", query)

        const doc = await documentsCollection.findOne(query)

        if (!doc) {
            console.error("[FETCH-DOCUMENT] Document not found for id:", id)
            return NextResponse.json(
                { error: "Document not found or access denied" },
                { status: 404 }
            )
        }

        console.log("[FETCH-DOCUMENT] Found document:", {
            id: doc._id,
            job_id: doc.job_id,
            has_parsed_data: !!doc.parsed_data,
            has_structured_data: !!doc.structured_data,
        })

        // Format response to match ParsedDocument interface
        const formattedData = {
            id: doc.job_id || doc._id?.toString(),
            fileName: doc.file_name || "Untitled Document",
            fileUrl: doc.file_url || undefined,
            uploadedAt: doc.created_at?.toISOString?.() || new Date().toISOString(),
            documentType: doc.document_type || "Medical Document",
            fields: doc.fields || [],
            summary: doc.summary || "",
            notes: doc.notes || [],
            structuredData: doc.structured_data || {},
            confidenceScore: doc.confidence_score || undefined,
            healthRecommendations: doc.health_recommendations || undefined,
        }

        console.log("[FETCH-DOCUMENT] Returning formatted data")

        return NextResponse.json(formattedData)
    } catch (error) {
        console.error("[FETCH-DOCUMENT] Error:", error)
        return NextResponse.json(
            { error: "Failed to fetch document" },
            { status: 500 }
        )
    }
}