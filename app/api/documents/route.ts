import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Number.parseInt(searchParams.get("limit") || "10")
    const userEmail = request.headers.get("x-user-email")

    const db = await getDatabase()
    const documentsCollection = db.collection("documents")
    const jobCollection = db.collection("job_ids")

    // Fetch from both collections and merge
    const [documents, jobRecords] = await Promise.all([
      documentsCollection
        .find(userEmail ? { user_email: userEmail } : {})
        .sort({ created_at: -1 })
        .toArray(),
      jobCollection
        .find(userEmail ? { user_email: userEmail } : {})
        .sort({ created_at: -1 })
        .toArray(),
    ])

    // Combine and sort by date
    const allRecords = [
      ...documents.map((doc: any) => ({
        id: doc._id?.toString() || doc._id,
        file_name: doc.file_name,
        created_at: doc.created_at,
        structured_data: doc.parsed_data || doc.structured_data || {},
        job_id: doc.job_id,
        report_id: doc.report_id,
        document_type: doc.document_type,
        status: doc.status,
      })),
      ...jobRecords.map((job: any) => ({
        id: job._id?.toString() || job._id,
        file_name: job.file_name,
        created_at: job.created_at,
        structured_data: job.parsed_data || {},
        job_id: job.job_id,
        report_id: job.report_id,
        document_type: job.document_type || "Medical Report",
        status: job.status,
      })),
    ]

    // Sort by date and remove duplicates
    const seen = new Set()
    const uniqueRecords = allRecords
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .filter((record) => {
        const key = record.job_id || record.id
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, limit)

    return NextResponse.json({ documents: uniqueRecords })
  } catch (error) {
    console.error("[DOCUMENTS] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
