import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const limit = Number.parseInt(searchParams.get("limit") || "10")
        // Get session user to check role
        const sessionUser = await getSessionUser(request)
        if (!sessionUser) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }
        const db = await getDatabase()
        const documentsCollection = db.collection("documents")
        const jobCollection = db.collection("job_ids")
        // Build filter: admins see all, users see only their own
        const userFilter = sessionUser.isAdmin ? {} : { user_email: sessionUser.email }
        // Fetch from both collections and merge
        const [documents, jobRecords] = await Promise.all([
            documentsCollection
                .find(userFilter)
                .sort({ created_at: -1 })
                .toArray(),
            jobCollection
                .find(userFilter)
                .sort({ created_at: -1 })
                .toArray(),
        ])
        console.log("[DOCUMENTS] Found documents:", documents.length, "jobs:", jobRecords.length)
        // Combine and sort by date
        const allRecords = [
            ...documents.map((doc: any) => ({
                id: doc.job_id || doc._id?.toString(),  // Prioritize job_id
                file_name: doc.file_name || "Unknown Document",
                created_at: doc.created_at || new Date().toISOString(),
                structured_data: doc.parsed_data || doc.structured_data || {},
                job_id: doc.job_id,
                report_id: doc.report_id,
                document_type: doc.document_type || "Medical Report",
                status: doc.status || "unknown",
                user_email: doc.user_email,
            })),
            ...jobRecords.map((job: any) => ({
                id: job.job_id || job._id?.toString(),  // Prioritize job_id
                file_name: job.file_name || "Unknown Document",
                created_at: job.created_at || new Date().toISOString(),
                structured_data: job.parsed_data || {},
                job_id: job.job_id,
                report_id: job.report_id,
                document_type: job.document_type || "Medical Report",
                status: job.status || "processing",
                user_email: job.user_email,
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
        console.log("[DOCUMENTS] Returning", uniqueRecords.length, "unique records")
        return NextResponse.json({ documents: uniqueRecords })
    } catch (error) {
        console.error("[DOCUMENTS] Error:", error)
        return NextResponse.json(
            { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown" },
            { status: 500 }
        )
    }
}