import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Number.parseInt(searchParams.get("limit") || "10")
    const userEmail = request.headers.get("x-user-email")

    const db = await getDatabase()
    const documentsCollection = db.collection("documents")

    // Build query - filter by user email if provided
    const query = userEmail ? { user_email: userEmail } : {}

    // Fetch documents from MongoDB
    const documents = await documentsCollection
      .find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray()

    // Map documents to include id field
    const mappedDocuments = documents.map((doc: any) => ({
      id: doc._id.toString(),
      file_name: doc.file_name,
      created_at: doc.created_at,
      structured_data: doc.parsed_data || {},
      job_id: doc.job_id,
      report_id: doc.report_id,
      document_type: doc.document_type,
    }))

    return NextResponse.json({ documents: mappedDocuments })
  } catch (error) {
    console.error("[DOCUMENTS] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
