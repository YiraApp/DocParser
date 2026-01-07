import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"

interface WebhookPayload {
  job_id: string
  report_id: string
  tenant_id: string
  project_id: string
  status: string
  timestamp: string
  parsed_data?: Record<string, any>
  fraud_detection?: Record<string, any>
  [key: string]: any
}

export async function POST(request: NextRequest) {
  console.log("[WEBHOOK] Received callback from external API")

  try {
    const payload: WebhookPayload = await request.json()

    console.log("[WEBHOOK] Payload job_id:", payload.job_id)
    console.log("[WEBHOOK] Payload status:", payload.status)

    // Validate webhook payload - only require job_id and status
    if (!payload.job_id) {
      console.error("[WEBHOOK] Missing job_id")
      return NextResponse.json(
        { error: "Invalid webhook payload - missing job_id" },
        { status: 400 }
      )
    }

    const db = await getDatabase()
    const webhookCollection = db.collection("webhook_responses")
    const jobCollection = db.collection("job_ids")

    // Extract parsed data from webhook
    const webhookRecord = {
      job_id: payload.job_id,
      report_id: payload.report_id,
      tenant_id: payload.tenant_id,
      project_id: payload.project_id,
      status: payload.status,
      timestamp: payload.timestamp,
      received_at: new Date(),
      processed: false,
      document_id: null,
      // Store all parsed data from the API response
      parsed_data: payload.parsed_data || null,
      fraud_detection: payload.fraud_detection || null,
    }

    const webhookResult = await webhookCollection.insertOne(webhookRecord)

    console.log("[WEBHOOK] Stored webhook with ID:", webhookResult.insertedId)

    // Update job_ids collection with parsed data and status
    const jobUpdateResult = await jobCollection.updateOne(
      { job_id: payload.job_id },
      {
        $set: {
          parsed_data: payload.parsed_data || null,
          structured_data: payload.parsed_data || null,
          fraud_detection: payload.fraud_detection || null,
          status: payload.status || "completed",
          updated_at: new Date(),
        }
      }
    )

    console.log("[WEBHOOK] Updated job_ids for job_id:", payload.job_id)
    console.log("[WEBHOOK] Matched documents:", jobUpdateResult.matchedCount)
    console.log("[WEBHOOK] Modified documents:", jobUpdateResult.modifiedCount)

    if (jobUpdateResult.matchedCount === 0) {
      console.warn("[WEBHOOK] No matching job found in job_ids collection for job_id:", payload.job_id)
    }

    return NextResponse.json(
      {
        success: true,
        message: "Webhook received and processed",
        job_id: payload.job_id,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[WEBHOOK] Error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Webhook processing failed",
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  console.log("[WEBHOOK] Fetching webhook responses")

  try {
    const jobId = request.nextUrl.searchParams.get("job_id")

    const db = await getDatabase()
    const webhookCollection = db.collection("webhook_responses")

    if (jobId) {
      const webhook = await webhookCollection.findOne({ job_id: jobId })
      if (!webhook) {
        return NextResponse.json(
          { error: "Webhook not found" },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        webhook: {
          id: webhook._id.toString(),
          job_id: webhook.job_id,
          report_id: webhook.report_id,
          status: webhook.status,
          received_at: webhook.received_at,
          parsed_data: webhook.parsed_data,
          fraud_detection: webhook.fraud_detection,
        },
      })
    }

    return NextResponse.json(
      { error: "job_id parameter required" },
      { status: 400 }
    )
  } catch (error) {
    console.error("[WEBHOOK] Error fetching:", error)
    return NextResponse.json(
      { error: "Failed to fetch webhook data" },
      { status: 500 }
    )
  }
}