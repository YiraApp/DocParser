import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"
import { ObjectId } from "mongodb"

export async function GET(request: NextRequest) {
  console.log("[PARSED_RESULTS] Fetch request")

  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const documentId = request.nextUrl.searchParams.get("document_id")

    if (!documentId) {
      return NextResponse.json(
        { error: "document_id parameter required" },
        { status: 400 }
      )
    }

    const db = await getDatabase()
    const documentsCollection = db.collection("documents")

    const document = await documentsCollection.findOne({
      _id: new ObjectId(documentId),
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
      document: {
        id: document._id.toString(),
        fileName: document.file_name,
        status: document.status,
        uploadedAt: document.created_at,
        jobId: document.job_id,
        reportId: document.report_id,
        parsedData: document.parsed_data,
        structuredData: document.structured_data,
        errorMessage: document.error_message,
      },
    })
  } catch (error) {
    console.error("[PARSED_RESULTS] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch parsed results" },
      { status: 500 }
    )
  }
}