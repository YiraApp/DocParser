import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"

export async function GET(request: NextRequest) {
    try {
        const db = await getDatabase()

        // Get counts from all collections
        const jobsCount = await db.collection("job_ids").countDocuments()
        const docsCount = await db.collection("documents").countDocuments()
        const webhooksCount = await db.collection("webhook_responses").countDocuments()

        // Get sample documents
        const lastJob = await db.collection("job_ids").findOne({}, { sort: { created_at: -1 } })
        const lastDoc = await db.collection("documents").findOne({}, { sort: { created_at: -1 } })
        const lastWebhook = await db.collection("webhook_responses").findOne({}, { sort: { received_at: -1 } })

        return NextResponse.json({
            status: "Database Status",
            collections: {
                job_ids: {
                    count: jobsCount,
                    lastRecord: lastJob ? {
                        job_id: lastJob.job_id,
                        file_name: lastJob.file_name,
                        status: lastJob.status,
                        has_parsed_data: !!lastJob.parsed_data,
                        user_email: lastJob.user_email,
                        created_at: lastJob.created_at,
                    } : null,
                },
                documents: {
                    count: docsCount,
                    lastRecord: lastDoc ? {
                        job_id: lastDoc.job_id,
                        file_name: lastDoc.file_name,
                        status: lastDoc.status,
                        has_parsed_data: !!lastDoc.parsed_data,
                        user_email: lastDoc.user_email,
                        created_at: lastDoc.created_at,
                    } : null,
                },
                webhook_responses: {
                    count: webhooksCount,
                    lastRecord: lastWebhook ? {
                        job_id: lastWebhook.job_id,
                        status: lastWebhook.status,
                        processed: lastWebhook.processed,
                        received_at: lastWebhook.received_at,
                    } : null,
                },
            },
        })
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 })
    }
}