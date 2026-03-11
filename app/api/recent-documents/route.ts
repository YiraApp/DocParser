import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const page = Number.parseInt(searchParams.get("page") || "1")
        const limit = Math.min(Number.parseInt(searchParams.get("limit") || "5"), 100)
        const filterEmail = searchParams.get("filterEmail") || ""
        const filterName = searchParams.get("filterName") || ""
        const filterUser = searchParams.get("filterUser") || ""

        const sessionUser = await getSessionUser(request)
        if (!sessionUser) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        // Only admins can filter - regular users can only see their own documents
        if (!sessionUser.isAdmin && (filterEmail || filterName || filterUser)) {
            return NextResponse.json(
                { error: "Filtering only available for admins" },
                { status: 403 }
            )
        }

        const db = await getDatabase()
        const jobCollection = db.collection("job_ids")
        const webhookCollection = db.collection("webhook_responses")

        // Build filter: admins can filter, users see only their own
        let dbFilter: any = sessionUser.isAdmin ? {} : { user_email: sessionUser.email }

        // Apply admin filters if provided
        if (sessionUser.isAdmin) {
            if (filterEmail) {
                dbFilter.user_email = { $regex: filterEmail, $options: "i" }
            }
            if (filterUser) {
                dbFilter.user_name = { $regex: filterUser, $options: "i" }
            }
            if (filterName) {
                dbFilter.file_name = { $regex: filterName, $options: "i" }
            }
        }

        // Get total count for pagination
        const totalCount = await jobCollection.countDocuments(dbFilter)

        // Calculate pagination
        const skip = (page - 1) * limit
        const totalPages = Math.ceil(totalCount / limit)

        // ✅ OPTIMIZED: Use aggregation to join with webhook collection
        const jobRecords = await jobCollection
            .aggregate([
                { $match: dbFilter },
                { $sort: { created_at: -1 } },
                { $skip: skip },
                { $limit: limit },
                // ✅ Left join with webhook_responses collection
                {
                    $lookup: {
                        from: "webhook_responses",
                        localField: "job_id",
                        foreignField: "job_id",
                        as: "webhook",
                    },
                },
                // ✅ Unwind the webhook array (will be null if no match)
                {
                    $unwind: {
                        path: "$webhook",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                // ✅ Project the final shape
                {
                    $project: {
                        id: "$job_id",
                        job_id: 1,
                        file_name: 1,
                        created_at: 1,
                        user_email: 1,
                        user_name: 1,
                        parsed_data: { $ifNull: ["$webhook.parsed_data", "$parsed_data"] },
                        status: { $ifNull: ["$webhook.status", "$status"] },
                    },
                },
            ])
            .toArray()

        // ✅ Filter out pending/processing documents
        const formattedDocuments = jobRecords
            .filter(doc => doc.status !== "pending" && doc.status !== "processing")
            .map((doc: any) => ({
                id: doc.id,
                job_id: doc.job_id,
                file_name: doc.file_name || "Unknown Document",
                created_at: doc.created_at || new Date().toISOString(),
                structured_data: {
                    ...(doc.parsed_data || {}),
                    rawParsedData: doc.parsed_data || {},
                },
                user_email: doc.user_email,
                user_name: doc.user_name || doc.user_email,
                status: doc.status,
            }))

        return NextResponse.json({
            success: true,
            documents: formattedDocuments,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            },
            isAdmin: sessionUser.isAdmin,
        })
    } catch (error) {
        console.error("[RECENT-DOCUMENTS] Error:", error)
        return NextResponse.json(
            { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown" },
            { status: 500 }
        )
    }
}