import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"

interface WebhookPayload {
  success: boolean
  job_id: string
  report_id: string
  status: string
  message: string
  files_uploaded: number
  total_size_mb: number
  webhook_url: string
  timestamp: string
  data?: {
    extracted_text?: string
    extracted_fields?: Record<string, any>
    structured_output?: Record<string, any>
    confidence_score?: number
    [key: string]: any
  }
}

export async function POST(request: NextRequest) {
  console.log("[WEBHOOK] Received callback")

  try {
    const payload: WebhookPayload = await request.json()

    console.log("[WEBHOOK] Payload job_id:", payload.job_id)

    // Validate webhook payload
    if (!payload.success || !payload.job_id) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 }
      )
    }

    const db = await getDatabase()
    const webhookCollection = db.collection("webhook_responses")

    // Extract parsed data from webhook
    const webhookRecord = {
      job_id: payload.job_id,
      report_id: payload.report_id,
      status: payload.status,
      message: payload.message,
      files_uploaded: payload.files_uploaded,
      total_size_mb: payload.total_size_mb,
      webhook_url: payload.webhook_url,
      received_at: new Date(),
      timestamp: payload.timestamp,
      processed: false,
      document_id: null,
      // Store parsed data from the API response
      parsed_data: payload.data ? {
        extracted_text: payload.data.extracted_text,
        extracted_fields: payload.data.extracted_fields,
        structured_output: payload.data.structured_output,
        confidence_score: payload.data.confidence_score,
      } : null,
    }

    const result = await webhookCollection.insertOne(webhookRecord)

    console.log("[WEBHOOK] Stored with ID:", result.insertedId)
    console.log("[WEBHOOK] Job ID:", payload.job_id)

    return NextResponse.json(
      {
        success: true,
        message: "Webhook received and processed",
        id: result.insertedId.toString(),
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