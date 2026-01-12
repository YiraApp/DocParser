import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"

interface UploadHistoryDocument {
    email: string
    uploadCount: number
    createdAt: Date
    lastUploadAt: Date
    uploadedDocuments: string[]
}

export async function POST(request: NextRequest) {
    try {
        // Only allow admin to run this migration
        const sessionUser = await getSessionUser(request)
        if (!sessionUser?.isAdmin) {
            return NextResponse.json(
                { error: "Admin only" },
                { status: 403 }
            )
        }

        const db = await getDatabase()
        const jobIdsCollection = db.collection("job_ids")
        const uploadHistoryCollection = db.collection<UploadHistoryDocument>("upload_history")

        console.log("[MIGRATE-UPLOAD-HISTORY] Starting migration...")

        // Get all documents from job_ids collection
        const allJobs = await jobIdsCollection.find({}).toArray()
        console.log(`[MIGRATE-UPLOAD-HISTORY] Found ${allJobs.length} total documents in job_ids`)

        // Group by email and count
        const emailUploadMap = new Map<string, { count: number; documents: string[]; lastUploadDate: Date }>()

        for (const job of allJobs) {
            const email = job.user_email || "unknown"
            const fileName = job.file_name || `Document_${job.job_id}`
            const createdAt = job.created_at || job.updated_at || new Date()

            if (!emailUploadMap.has(email)) {
                emailUploadMap.set(email, {
                    count: 0,
                    documents: [],
                    lastUploadDate: createdAt,
                })
            }

            const emailData = emailUploadMap.get(email)!
            emailData.count += 1
            emailData.documents.push(fileName)

            // Update lastUploadDate if this document is newer
            if (createdAt > emailData.lastUploadDate) {
                emailData.lastUploadDate = createdAt
            }
        }

        console.log(`[MIGRATE-UPLOAD-HISTORY] Grouped into ${emailUploadMap.size} unique emails`)

        // Clear existing upload_history
        const deleteResult = await uploadHistoryCollection.deleteMany({})
        console.log(`[MIGRATE-UPLOAD-HISTORY] Deleted ${deleteResult.deletedCount} existing records`)

        // Insert records for each email
        let insertedCount = 0
        const insertErrors: string[] = []

        for (const [email, data] of emailUploadMap) {
            if (!email || email === "unknown") {
                console.warn(`[MIGRATE-UPLOAD-HISTORY] Skipping entry with invalid email: ${email}`)
                continue
            }

            try {
                const historyRecord: UploadHistoryDocument = {
                    email: email,
                    uploadCount: data.count,
                    createdAt: new Date(),
                    lastUploadAt: data.lastUploadDate,
                    uploadedDocuments: data.documents,
                } as UploadHistoryDocument

                await uploadHistoryCollection.insertOne(historyRecord)
                insertedCount++
                console.log(`[MIGRATE-UPLOAD-HISTORY] ✅ Created record for ${email}: ${data.count} uploads`)
            } catch (error) {
                const errorMsg = `Failed to insert for ${email}: ${error instanceof Error ? error.message : "Unknown error"}`
                console.error(`[MIGRATE-UPLOAD-HISTORY] ❌ ${errorMsg}`)
                insertErrors.push(errorMsg)
            }
        }

        console.log(`[MIGRATE-UPLOAD-HISTORY] ===== MIGRATION COMPLETE =====`)

        return NextResponse.json({
            success: true,
            message: "Migration completed successfully",
            stats: {
                totalJobsProcessed: allJobs.length,
                uniqueEmailsFound: emailUploadMap.size,
                recordsInserted: insertedCount,
                errors: insertErrors.length > 0 ? insertErrors : null,
            }
        })
    } catch (error) {
        console.error("[MIGRATE-UPLOAD-HISTORY] Fatal error:", error)
        return NextResponse.json(
            {
                success: false,
                error: "Migration failed",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    try {
        // Only allow admin to check status
        const sessionUser = await getSessionUser(request)
        if (!sessionUser?.isAdmin) {
            return NextResponse.json(
                { error: "Admin only" },
                { status: 403 }
            )
        }

        const db = await getDatabase()
        const jobIdsCollection = db.collection("job_ids")
        const uploadHistoryCollection = db.collection("upload_history")

        const totalJobs = await jobIdsCollection.countDocuments({})
        const uploadHistoryRecords = await uploadHistoryCollection.find({}).toArray()

        // Calculate total uploads from upload_history
        let totalUploadsInHistory = 0
        uploadHistoryRecords.forEach(record => {
            totalUploadsInHistory += record.uploadCount || 0
        })

        return NextResponse.json({
            success: true,
            stats: {
                totalJobsInJobIds: totalJobs,
                recordsInUploadHistory: uploadHistoryRecords.length,
                totalUploadsInHistory: totalUploadsInHistory,
                uploadsByEmail: uploadHistoryRecords.map(r => ({
                    email: r.email,
                    count: r.uploadCount,
                    lastUpload: r.lastUploadAt,
                }))
            }
        })
    } catch (error) {
        console.error("[MIGRATE-UPLOAD-HISTORY GET] Error:", error)
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch stats"
            },
            { status: 500 }
        )
    }
}