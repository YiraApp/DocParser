import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")

  console.log("[SEARCH] Search request received:", { query })

  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ documents: [] })
    }

    const db = await getDatabase()
    const documentsCollection = db.collection("documents")
    const jobCollection = db.collection("job_ids")

    // Build search filter - search across multiple fields including patient name
    const searchFilter: any = {
      $or: [
        { file_name: { $regex: query, $options: "i" } },
        { file_type: { $regex: query, $options: "i" } },
        { document_type: { $regex: query, $options: "i" } },
        // Search in parsed data for patient name
        { "parsed_data.patient_name": { $regex: query, $options: "i" } },
        // Search in structured data for patient info
        { "structured_data.patientInfo.fullName": { $regex: query, $options: "i" } },
        { "structured_data.patientInfo.name": { $regex: query, $options: "i" } },
      ],
    }

    // CRITICAL: Admin can search all documents, users search ONLY their own
    if (!sessionUser.isAdmin) {
      searchFilter.user_email = sessionUser.email
    }

    const documents = await documentsCollection
      .find(searchFilter)
      .sort({ created_at: -1 })
      .limit(20)
      .toArray()

    console.log(
      "[SEARCH] Found",
      documents.length,
      "documents for user:",
      sessionUser.email,
      "isAdmin:",
      sessionUser.isAdmin,
      "query:",
      query
    )

    return NextResponse.json({
      success: true,
      documents: documents.map((doc: any) => ({
        id: doc._id?.toString() || doc.job_id,
        file_name: doc.file_name,
        file_type: doc.file_type,
        file_size: doc.file_size,
        created_at: doc.created_at,
        status: doc.status,
        user_email: doc.user_email,
        document_type: doc.document_type,
        // Include structured data for preview
        structured_data: doc.structured_data,
        user_name: doc.user_email?.split("@")[0] || "Unknown",
      })),
      count: documents.length,
    })
  } catch (error) {
    console.error("[SEARCH] Error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Search failed",
      },
      { status: 500 }
    )
  }
}
