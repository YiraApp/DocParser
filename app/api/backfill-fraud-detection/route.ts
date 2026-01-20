import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"

export async function POST(request: NextRequest) {
    try {
        const sessionUser = await getSessionUser(request)
        if (!sessionUser?.isAdmin) {
            return NextResponse.json({ error: "Admin only" }, { status: 403 })
        }

        const db = await getDatabase()
        const webhookCollection = db.collection("webhook_responses")
        const documentsCollection = db.collection("documents")

        console.log("[BACKFILL-FRAUD] ===== STARTING BACKFILL =====")

        // Find all webhooks with fraud_detection
        const webhooksWithFraud = await webhookCollection
            .find({
                fraud_detection: { $exists: true, $ne: null },
                job_id: { $exists: true }
            })
            .toArray()

        console.log(`[BACKFILL-FRAUD] Found ${webhooksWithFraud.length} webhooks with fraud_detection`)

        let updatedCount = 0
        let notFoundCount = 0
        let alreadyHadCount = 0
        const errors: any[] = []

        for (const webhook of webhooksWithFraud) {
            try {
                console.log(`[BACKFILL-FRAUD] Processing job_id: ${webhook.job_id}`)
                console.log(`[BACKFILL-FRAUD] Webhook fraud_detection:`, JSON.stringify(webhook.fraud_detection))

                // Find corresponding document
                const document = await documentsCollection.findOne({ job_id: webhook.job_id })

                if (!document) {
                    console.log(`[BACKFILL-FRAUD] ⚠️ Document not found for job_id: ${webhook.job_id}`)
                    notFoundCount++
                    continue
                }

                // Check if document already has non-null fraud_detection
                if (document.fraud_detection && 
                    typeof document.fraud_detection === 'object' &&
                    Object.keys(document.fraud_detection).length > 0) {
                    console.log(`[BACKFILL-FRAUD] ℹ️ Document ${webhook.job_id} already has fraud_detection`)
                    alreadyHadCount++
                    continue
                }

                console.log(`[BACKFILL-FRAUD] Current document fraud_detection state:`, document.fraud_detection)

                // ✅ CRITICAL FIX: Bind fraud_detection to BOTH root and structured_data paths  
                const updateResult = await documentsCollection.updateOne(
                    { job_id: webhook.job_id },
                    {
                        $set: {
                            fraud_detection: webhook.fraud_detection,
                            "structured_data.fraudDetection": webhook.fraud_detection,
                            updated_at: new Date(),
                        }
                    }
                )

                if (updateResult.modifiedCount > 0) {
                    console.log(`[BACKFILL-FRAUD] ✅ Updated document ${webhook.job_id}`)
                    console.log(`[BACKFILL-FRAUD] 📊 Fraud Detection:`, JSON.stringify(webhook.fraud_detection).substring(0, 200))
                    updatedCount++
                } else {
                    console.log(`[BACKFILL-FRAUD] ⚠️ Document matched but not modified: ${webhook.job_id}`)
                }
            } catch (err) {
                const errMsg = `Error updating ${webhook.job_id}: ${err instanceof Error ? err.message : String(err)}`
                console.error(`[BACKFILL-FRAUD] ❌ ${errMsg}`)
                errors.push({
                    job_id: webhook.job_id,
                    error: errMsg,
                })
            }
        }

        console.log(`[BACKFILL-FRAUD] ===== BACKFILL COMPLETE =====`)
        console.log(`[BACKFILL-FRAUD] Summary:`)
        console.log(`  - Updated: ${updatedCount}`)
        console.log(`  - Already had fraud_detection: ${alreadyHadCount}`)
        console.log(`  - Document not found: ${notFoundCount}`)
        console.log(`  - Errors: ${errors.length}`)

        return NextResponse.json({
            success: true,
            message: "Backfill complete",
            updated: updatedCount,
            alreadyHad: alreadyHadCount,
            notFound: notFoundCount,
            errors: errors.length > 0 ? errors : undefined,
        })
    } catch (error) {
        console.error("[BACKFILL-FRAUD] Fatal error:", error)
        return NextResponse.json(
            { error: "Backfill failed", details: error instanceof Error ? error.message : "Unknown" },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    try {
        const sessionUser = await getSessionUser(request)
        if (!sessionUser?.isAdmin) {
            return NextResponse.json({ error: "Admin only" }, { status: 403 })
        }

        const db = await getDatabase()
        const webhookCollection = db.collection("webhook_responses")
        const documentsCollection = db.collection("documents")

        const webhooksWithFraud = await webhookCollection.countDocuments({
            fraud_detection: { $exists: true, $ne: null }
        })

        const docsWithFraud = await documentsCollection.countDocuments({
            fraud_detection: { $exists: true, $ne: null }
        })

        // Count documents that have null fraud_detection (not just missing)
        const docsWithNullFraud = await documentsCollection.countDocuments({
            fraud_detection: null
        })

        const docsNeedingFraud = await documentsCollection.countDocuments({
            $or: [
                { fraud_detection: { $exists: false } },
                { fraud_detection: null }
            ]
        })

        // Get sample of documents needing update
        const sampleDocsNeedingFraud = await documentsCollection
            .find({
                $or: [
                    { fraud_detection: { $exists: false } },
                    { fraud_detection: null }
                ]
            })
            .limit(5)
            .toArray()

        return NextResponse.json({
            webhooks: {
                withFraudDetection: webhooksWithFraud
            },
            documents: {
                total: await documentsCollection.countDocuments(),
                withFraudDetection: docsWithFraud,
                withNullFraud: docsWithNullFraud,
                needingFraudDetection: docsNeedingFraud
            },
            samples: {
                docsNeedingUpdate: sampleDocsNeedingFraud.map(d => ({
                    job_id: d.job_id,
                    file_name: d.file_name,
                    fraud_detection: d.fraud_detection
                }))
            },
            status: docsNeedingFraud > 0 ? "Ready to backfill" : "All synced"
        })
    } catch (error) {
        console.error("[BACKFILL-FRAUD GET] Error:", error)
        return NextResponse.json(
            { error: "Failed to check status" },
            { status: 500 }
        )
    }
}