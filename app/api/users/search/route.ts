import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"

export async function GET(request: NextRequest) {
    try {
        const sessionUser = await getSessionUser(request)
        if (!sessionUser) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        // Only admin can search users
        if (!sessionUser.isAdmin) {
            return NextResponse.json(
                { error: "Only admin can search users" },
                { status: 403 }
            )
        }

        const query = request.nextUrl.searchParams.get("q")

        if (!query || query.trim().length === 0) {
            return NextResponse.json({ users: [] })
        }

        const db = await getDatabase()
        const usersCollection = db.collection("users")

        // Search users by email
        const users = await usersCollection
            .find({
                email: { $regex: query, $options: "i" }
            })
            .project({
                _id: 1,
                email: 1,
                name: 1,
                created_at: 1
            })
            .limit(10)
            .toArray()

        console.log(
            "[SEARCH USERS] Found",
            users.length,
            "users matching email:",
            query
        )

        return NextResponse.json({
            success: true,
            users: users.map((user: any) => ({
                id: user._id?.toString(),
                email: user.email,
                name: user.name || "Unknown",
                created_at: user.created_at
            })),
            count: users.length,
        })
    } catch (error) {
        console.error("[SEARCH USERS] Error:", error)
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Search failed",
            },
            { status: 500 }
        )
    }
}