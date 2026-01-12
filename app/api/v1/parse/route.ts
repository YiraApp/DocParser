import { type NextRequest, NextResponse } from "next/server"

export const maxDuration = 300
export const dynamic = "force-dynamic"

const QUEUE_LIMITS = {
  free: 2,
  basic: 10,
  pro: 50,
  enterprise: 1000,
}

// Placeholder: Replace with MongoDB authentication
async function authenticateTenant(apiKey: string | null) {
  if (!apiKey) {
    return { error: "Missing API key", status: 401 }
  }

  // TODO: Implement MongoDB tenant authentication
  // For now, accept any non-empty API key
  if (apiKey === "test-key") {
    return {
      tenant: {
        id: "tenant-001",
        name: "Test Tenant",
        is_active: true,
        webhook_url: process.env.DEFAULT_WEBHOOK_URL || "http://localhost:3000/webhook",
        tier: "basic",
      },
    }
  }

  return { error: "Invalid API key", status: 401 }
}

export async function POST(request: NextRequest) {
  console.log("[API] Tenant API: Parse request received")

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

    // TODO: Implement MongoDB queue management
    const queueLimit = QUEUE_LIMITS[tenant.tier as keyof typeof QUEUE_LIMITS] || QUEUE_LIMITS.free

    // Generate job ID
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    console.log(`[API] Created job ${jobId} for tenant ${tenant.name}`)

    // Return job ID immediately for async processing
    return NextResponse.json(
      {
        job_id: jobId,
        status: "pending",
        message: "Document processing started. You will receive a callback when complete.",
        callback_url: callbackUrl,
        queue_position: 0,
        queue_limit: queueLimit,
      },
      { status: 202 },
    )

    // TODO: Start async processing with MongoDB integration
  } catch (error) {
    console.error("[API] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 },
    )
  }
}

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

  // TODO: Implement MongoDB job status query
  return NextResponse.json({
    job_id: jobId,
    status: "pending",
    document_id: null,
    error_message: null,
    created_at: new Date().toISOString(),
    completed_at: null,
    callback_attempts: 0,
    queue_position: 0,
  })
}
