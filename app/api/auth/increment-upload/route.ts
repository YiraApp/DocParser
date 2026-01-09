import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"
import type { Document } from "mongodb"

interface UploadHistoryDocument extends Document {
    email: string
    uploadCount: number
    createdAt: Date
    lastUploadAt: Date
    uploadedDocuments: string[]
}

export async function POST(request: NextRequest) {
    try {
        const sessionUser = await getSessionUser(request)
        if (!sessionUser) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        // Don't increment for admin accounts
        if (sessionUser.isAdmin) {
            return NextResponse.json({
                success: true,
                uploadCount: -1, // Admins have unlimited uploads
                message: "Admin accounts have unlimited uploads"
            })
        }

        const db = await getDatabase()
        const uploadHistoryCollection = db.collection<UploadHistoryDocument>("upload_history")
        const usersCollection = db.collection("users")

        // Get current upload count for this user
        const userUploadRecord = await uploadHistoryCollection.findOne({
            email: sessionUser.email
        })

        let uploadCount: number

        if (!userUploadRecord) {
            // First upload for this user
            const newDocument: UploadHistoryDocument = {
                email: sessionUser.email,
                uploadCount: 1,
                createdAt: new Date(),
                lastUploadAt: new Date(),
                uploadedDocuments: []
            } as UploadHistoryDocument

            const insertResult = await uploadHistoryCollection.insertOne(newDocument)
            uploadCount = 1

            console.log("[INCREMENT-UPLOAD] Created new upload history for:", sessionUser.email, "ID:", insertResult.insertedId)
        } else {
            // Increment upload count
            uploadCount = (userUploadRecord.uploadCount || 0) + 1
            await uploadHistoryCollection.updateOne(
                { email: sessionUser.email },
                {
                    $set: {
                        uploadCount: uploadCount,
                        lastUploadAt: new Date()
                    }
                }
            )

            console.log("[INCREMENT-UPLOAD] Updated upload count for:", sessionUser.email, "New count:", uploadCount)
        }

        // Also update the users collection if it exists
        try {
            await usersCollection.updateOne(
                { email: sessionUser.email },
                {
                    $set: {
                        uploadCount: uploadCount,
                        lastUploadAt: new Date()
                    }
                }
            )
        } catch (err) {
            console.warn("[INCREMENT-UPLOAD] Could not update users collection:", err)
            // Continue anyway, upload_history is the source of truth
        }

        return NextResponse.json({
            success: true,
            uploadCount: uploadCount,
            email: sessionUser.email
        })
    } catch (error) {
        console.error("[INCREMENT-UPLOAD] Error:", error)
        return NextResponse.json(
            { error: "Failed to increment upload count", details: error instanceof Error ? error.message : "Unknown" },
            { status: 500 }
        )
    }
}