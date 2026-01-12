import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"
    
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const page = Number.parseInt(searchParams.get("page") || "1")
        const limit = Number.parseInt(searchParams.get("limit") || "5")
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
        const documentsCollection = db.collection("documents")
        const usersCollection = db.collection("users")

        // Build filter: admins can filter, users see only their own
        let dbFilter: any = sessionUser.isAdmin ? {} : { user_email: sessionUser.email }

        // Apply admin filters if provided - only filter on documents collection (processed data)
        if (sessionUser.isAdmin) {
            if (filterEmail) {
                dbFilter.user_email = { $regex: filterEmail, $options: "i" }
            }
            if (filterUser) {
                // Search by user name - need to join with users collection
                // For now, we'll handle this in post-processing
            }
            if (filterName) {
                dbFilter.file_name = { $regex: filterName, $options: "i" }
            }
        }

        // Fetch users for name mapping
        const users = await usersCollection.find({}).toArray()

        // Create email to name map
        const userNameMap = new Map()
        users.forEach((user: any) => {
            userNameMap.set(user.email, user.name || user.email)
        })

        // Get total count for pagination (before applying user name filter)
        let totalCount = await documentsCollection.countDocuments(dbFilter)

        // Fetch all matching documents first
        const allDocuments = await documentsCollection
            .find(dbFilter)
            .sort({ created_at: -1 })
            .toArray()

        // Apply user name filter in post-processing if provided
        let filteredDocuments = allDocuments
        if (sessionUser.isAdmin && filterUser) {
            filteredDocuments = allDocuments.filter((doc: any) => {
                const userName = userNameMap.get(doc.user_email) || doc.user_email || ""
                return userName.toLowerCase().includes(filterUser.toLowerCase())
            })
            totalCount = filteredDocuments.length
        } else {
            filteredDocuments = allDocuments
        }

        // Calculate pagination
        const skip = (page - 1) * limit
        const totalPages = Math.ceil(totalCount / limit)

        // Apply pagination
        const paginatedDocuments = filteredDocuments.slice(skip, skip + limit)

        const formattedDocuments = paginatedDocuments.map((doc: any) => ({
            id: doc.job_id || doc._id?.toString(),
            job_id: doc.job_id,
            file_name: doc.file_name || "Unknown Document",
            created_at: doc.created_at || new Date().toISOString(),
            structured_data: doc.parsed_data || doc.structured_data || {},
            user_email: doc.user_email,
            user_name: userNameMap.get(doc.user_email) || doc.user_email,
            status: doc.status || "processing",
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