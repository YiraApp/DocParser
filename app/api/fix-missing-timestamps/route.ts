import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"

/**
 * Fix missing created_at timestamps in documents collection
 * This ensures all documents are visible in the recent-documents endpoint
 */
export async function POST(request: NextRequest) {
    console.log("[FIX-TIMESTAMPS] ===== STARTING TIMESTAMP FIX =====")

    try {
        const db = await getDatabase()
        const documentsCollection = db.collection("documents")

        // Find all documents without created_at field
        const docsWithoutTimestamp = await documentsCollection
            .find({
                created_at: { $exists: false }
            })
            .toArray()

        console.log(
            `[FIX-TIMESTAMPS] Found ${docsWithoutTimestamp.length} documents without created_at`
        )

        let fixedCount = 0
        const errors: any[] = []

        // Fix each document by adding created_at = now
        for (const doc of docsWithoutTimestamp) {
            try {
                const updateResult = await documentsCollection.updateOne(
                    { _id: doc._id },
                    {
                        $set: {
                            created_at: new Date(),
                            updated_at: new Date(),
                        }
                    }
                )

                if (updateResult.modifiedCount > 0) {
                    console.log(
                        `[FIX-TIMESTAMPS] ✅ Fixed document: ${doc.job_id || doc._id}`
                    )
                    fixedCount++
                }
            } catch (err) {
                const errMsg = `Error fixing ${doc.job_id || doc._id}: ${
                    err instanceof Error ? err.message : String(err)
                }`
                console.error(`[FIX-TIMESTAMPS] ❌ ${errMsg}`)
                errors.push({
                    docId: doc._id.toString(),
                    job_id: doc.job_id,
                    error: errMsg,
                })
            }
        }

        console.log("[FIX-TIMESTAMPS] ===== FIX COMPLETE =====")

        return NextResponse.json({
            success: true,
            message: `Fixed ${fixedCount} documents with missing timestamps`,
            fixedCount,
            errors: errors.length > 0 ? errors : undefined,
        })
    } catch (error) {
        console.error("[FIX-TIMESTAMPS] ❌ Fatal error:", error)
        return NextResponse.json(
            {
                error: "Fix failed",
                details: error instanceof Error ? error.message : "Unknown",
            },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    try {
        const db = await getDatabase()
        const documentsCollection = db.collection("documents")

        const docsWithoutTimestamp = await documentsCollection.countDocuments({
            created_at: { $exists: false }
        })

        const docsWithTimestamp = await documentsCollection.countDocuments({
            created_at: { $exists: true }
        })

        return NextResponse.json({
            status: "Timestamp Check",
            withTimestamp: docsWithTimestamp,
            withoutTimestamp: docsWithoutTimestamp,
            needsFix: docsWithoutTimestamp > 0,
            fixUrl: "/api/fix-missing-timestamps",
        })
    } catch (error) {
        console.error("[FIX-TIMESTAMPS GET] Error:", error)
        return NextResponse.json(
            {
                error: "Check failed",
                details: error instanceof Error ? error.message : "Unknown",
            },
            { status: 500 }
        )
    }
}