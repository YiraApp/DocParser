import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-server"
import { getDatabase } from "@/lib/db"

export async function GET(request: NextRequest) {
    try {
        const sessionUser = await getSessionUser(request)
        if (!sessionUser) {
            return NextResponse.json(
                { success: false, error: "Not authenticated" },
                { status: 401 }
            )
        }

        // Get full user data from database
        const db = await getDatabase()
        const usersCollection = db.collection("users")
        const jobIdsCollection = db.collection("job_ids")
        
        const user = await usersCollection.findOne({ email: sessionUser.email })

        if (!user) {
            return NextResponse.json(
                { success: false, error: "User not found" },
                { status: 404 }
            )
        }

        // Get actual upload count from job_ids collection by counting documents for this user
        let uploadCount = 0
        if (user.role !== "admin") {
            const count = await jobIdsCollection.countDocuments({
                user_email: sessionUser.email
            })
            uploadCount = count || 0
            console.log(`[ME] User ${sessionUser.email} has ${uploadCount} documents in job_ids`)
        } else {
            uploadCount = -1 // Admins have unlimited uploads
        }

        return NextResponse.json({
            success: true,
            user: {
                id: user._id.toString(),
                email: user.email,
                name: user.name,
                phoneNumber: user.phoneNumber,
                role: user.role,
                uploadCount: uploadCount,
            },
        })
    } catch (error) {
        console.error("[ME] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch user" },
            { status: 500 }
        )
    }
}