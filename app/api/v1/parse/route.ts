import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 300
export const dynamic = "force-dynamic"

const QUEUE_LIMITS = {
  free: 2,
  basic: 10,
  pro: 50,
  enterprise: 1000,
}

// Validate API key and get tenant
async function authenticateTenant(apiKey: string | null) {
  if (!apiKey) {
    return { error: "Missing API key", status: 401 }
  }

  const supabase = await createClient()
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id, name, is_active, webhook_url, tier")
    .eq("api_key", apiKey)
    .single()

  if (error || !tenant) {
    return { error: "Invalid API key", status: 401 }
  }

  if (!tenant.is_active) {
    return { error: "Tenant account is inactive", status: 403 }
  }

  return { tenant }
}

// Trigger webhook callback
async function triggerWebhook(callbackUrl: string, jobId: string, documentId: string, status: string, data?: any) {
  try {
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": "document.processing.completed",
      },
      body: JSON.stringify({
        job_id: jobId,
        document_id: documentId,
        status,
        timestamp: new Date().toISOString(),
        data,
      }),
    })

    return response.ok
  } catch (error) {
    console.error("[v0] Webhook callback failed:", error)
    return false
  }
}

export async function POST(request: NextRequest) {
  console.log("[v0] Tenant API: Parse request received")

  // Authenticate tenant
  const apiKey = request.headers.get("X-API-Key")
  const authResult = await authenticateTenant(apiKey)

  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { tenant } = authResult

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const callbackUrl = (formData.get("callback_url") as string) || tenant.webhook_url

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!callbackUrl) {
      return NextResponse.json(
        { error: "No callback URL provided and tenant has no default webhook URL" },
        { status: 400 },
      )
    }

    // Validate file type
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only PDF, PNG, JPG, and JPEG files are supported" }, { status: 400 })
    }

    const supabase = await createClient()

    const { count: activeJobsCount, error: countError } = await supabase
      .from("processing_jobs")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .in("status", ["pending", "processing"])

    if (countError) {
      console.error("[v0] Failed to check queue:", countError)
      return NextResponse.json({ error: "Failed to check processing queue" }, { status: 500 })
    }

    const queueLimit = QUEUE_LIMITS[tenant.tier as keyof typeof QUEUE_LIMITS] || QUEUE_LIMITS.free

    if ((activeJobsCount || 0) >= queueLimit) {
      return NextResponse.json(
        {
          error: "Processing queue limit reached",
          message: `Your ${tenant.tier} tier allows ${queueLimit} concurrent jobs. Currently processing: ${activeJobsCount}. Please wait for existing jobs to complete.`,
          queue_limit: queueLimit,
          current_queue_size: activeJobsCount,
          tier: tenant.tier,
        },
        { status: 429 },
      )
    }

    // Create processing job immediately
    const { data: job, error: jobError } = await supabase
      .from("processing_jobs")
      .insert({
        tenant_id: tenant.id,
        status: "pending",
        callback_url: callbackUrl,
      })
      .select()
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: "Failed to create processing job" }, { status: 500 })
    }

    console.log(`[v0] Created job ${job.id} for tenant ${tenant.name}`)

    const { count: pendingJobsCount } = await supabase
      .from("processing_jobs")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("status", "pending")
      .lt("created_at", job.created_at)

    // Return job ID immediately for async processing
    const jobResponse = NextResponse.json(
      {
        job_id: job.id,
        status: "pending",
        message: "Document processing started. You will receive a callback when complete.",
        callback_url: callbackUrl,
        queue_position: pendingJobsCount || 0,
        queue_limit: queueLimit,
      },
      { status: 202 },
    )

    // Start async processing (fire and forget)
    processDocumentAsync(job.id, tenant.id, file, callbackUrl).catch((error) => {
      console.error(`[v0] Async processing failed for job ${job.id}:`, error)
    })

    return jobResponse
  } catch (error) {
    console.error("[v0] API error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 },
    )
  }
}

// Async processing function
async function processDocumentAsync(jobId: string, tenantId: string, file: File, callbackUrl: string) {
  const supabase = await createClient()

  try {
    // Update job status to processing
    await supabase
      .from("processing_jobs")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", jobId)

    console.log(`[v0] Processing job ${jobId}...`)

    // Convert file to images (handle PDF or direct image)
    let imageFiles: File[] = []
    const originalFileName = file.name

    if (file.type === "application/pdf") {
      // In production, you'd use a PDF to image converter here
      // For now, treat as single file
      imageFiles = [file]
    } else {
      imageFiles = [file]
    }

    // Call internal parsing logic
    const formData = new FormData()
    imageFiles.forEach((img) => formData.append("files", img))
    formData.append("originalFileName", originalFileName)
    formData.append("isMultiPage", imageFiles.length > 1 ? "true" : "false")

    const parseResponse = await fetch(
      new URL("/api/parse-document", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
      {
        method: "POST",
        body: formData,
      },
    )

    if (!parseResponse.ok) {
      throw new Error(`Parse failed: ${await parseResponse.text()}`)
    }

    const parseResult = await parseResponse.json()

    // Update document with tenant_id
    await supabase.from("documents").update({ tenant_id: tenantId }).eq("id", parseResult.id)

    // Update processing job with document_id
    await supabase
      .from("processing_jobs")
      .update({
        document_id: parseResult.id,
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)

    console.log(`[v0] Job ${jobId} completed. Triggering webhook...`)

    // Trigger callback
    const webhookSuccess = await triggerWebhook(callbackUrl, jobId, parseResult.id, "completed", {
      document_id: parseResult.id,
      confidence_score: parseResult.confidenceScore,
      pages_processed: parseResult.pagesProcessed,
    })

    if (webhookSuccess) {
      await supabase
        .from("processing_jobs")
        .update({
          callback_attempts: 1,
          callback_last_attempt: new Date().toISOString(),
        })
        .eq("id", jobId)
      console.log(`[v0] Webhook callback successful for job ${jobId}`)
    } else {
      await supabase
        .from("processing_jobs")
        .update({
          callback_attempts: 1,
          callback_last_attempt: new Date().toISOString(),
          error_message: "Webhook callback failed",
        })
        .eq("id", jobId)
      console.warn(`[v0] Webhook callback failed for job ${jobId}`)
    }
  } catch (error) {
    console.error(`[v0] Processing failed for job ${jobId}:`, error)

    await supabase
      .from("processing_jobs")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)

    // Attempt to notify via webhook about failure
    await triggerWebhook(callbackUrl, jobId, "", "failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

// Get job status
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("X-API-Key")
  const jobId = request.nextUrl.searchParams.get("job_id")

  const authResult = await authenticateTenant(apiKey)
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  if (!jobId) {
    return NextResponse.json({ error: "Missing job_id parameter" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: job, error } = await supabase
    .from("processing_jobs")
    .select("id, status, document_id, error_message, created_at, completed_at, callback_attempts")
    .eq("id", jobId)
    .eq("tenant_id", authResult.tenant.id)
    .single()

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  let queuePosition = 0
  if (job.status === "pending") {
    const { count } = await supabase
      .from("processing_jobs")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", authResult.tenant.id)
      .eq("status", "pending")
      .lt("created_at", job.created_at)

    queuePosition = count || 0
  }

  return NextResponse.json({
    job_id: job.id,
    status: job.status,
    document_id: job.document_id,
    error_message: job.error_message,
    created_at: job.created_at,
    completed_at: job.completed_at,
    callback_attempts: job.callback_attempts,
    queue_position: queuePosition,
  })
}
