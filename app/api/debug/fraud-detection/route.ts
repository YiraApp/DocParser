import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"

export async function GET(request: NextRequest) {
    try {
        const sessionUser = await getSessionUser(request)
        if (!sessionUser?.isAdmin) {
            return NextResponse.json({ error: "Admin only" }, { status: 403 })
        }

        const db = await getDatabase()
        const webhookCollection = db.collection("webhook_responses")
        const documentsCollection = db.collection("documents")

        // Check webhook_responses
        const webhooksWithFraud = await webhookCollection
            .find({ fraud_detection: { $exists: true, $ne: null } })
            .limit(5)
            .toArray()

        // Check documents
        const docsWithFraud = await documentsCollection
            .find({ fraud_detection: { $exists: true, $ne: null } })
            .limit(5)
            .toArray()

        // Check documents without fraud_detection
        const docsWithoutFraud = await documentsCollection
            .find({ fraud_detection: { $exists: false } })
            .limit(5)
            .toArray()

        return NextResponse.json({
            webhook_responses: {
                count: webhooksWithFraud.length,
                sample: webhooksWithFraud.map(w => ({
                    job_id: w.job_id,
                    has_fraud_detection: !!w.fraud_detection,
                    fraud_detection_keys: w.fraud_detection ? Object.keys(w.fraud_detection) : []
                }))
            },
            documents: {
                with_fraud_detection: docsWithFraud.length,
                without_fraud_detection: docsWithoutFraud.length,
                sample_with: docsWithFraud.map(d => ({
                    job_id: d.job_id,
                    has_field: !!d.fraud_detection,
                })),
                sample_without: docsWithoutFraud.map(d => ({
                    job_id: d.job_id,
                    has_fraud_detection_in_parsed: !!d.parsed_data?.fraud_detection,
                }))
            }
        })
    } catch (error) {
        console.error("[DEBUG] Error:", error)
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}