import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"

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
                webhook_url: process.env.DEFAULT_WEBHOOK_URL || "http://74.225.14.24:3029/api/webhook",
                tier: "basic",
            

        }
    }

    return { error: "Invalid API key", status: 401 }
}

// Mock document parsing function - replace with actual parsing logic
async function parseDocument(file: File): Promise<{
    extracted_text: string
    extracted_fields: Record<string, any>
    structured_output: Record<string, any>
    confidence_score: number
}> {
    // TODO: Implement actual document parsing logic
    // This is a placeholder that simulates parsing
    return {
        extracted_text: "Sample extracted text from document",
        extracted_fields: {
            title: "Document Title",
            date: new Date().toISOString(),
            author: "Unknown",
        },
        structured_output: {
            sections: ["Introduction", "Body", "Conclusion"],
            word_count: 1500,
            language: "en",
        },
        confidence_score: 0.95,
    }
}

// Send webhook callback with parsed data (non-blocking)
async function sendWebhookCallback(
    webhookUrl: string,
    jobId: string,
    parsedData: any,
    tenantId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const payload = {
            success: true,
            job_id: jobId,
            tenant_id: tenantId,
            status: "completed",
            message: "Document parsing completed successfully",
            timestamp: new Date().toISOString(),
            data: parsedData,
        }

        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            console.error(`[WEBHOOK] Failed to send callback: ${response.status} ${response.statusText}`)
            return { success: false, error: `HTTP ${response.status}` }
        }

        console.log(`[WEBHOOK] Successfully sent callback to ${webhookUrl}`)
        return { success: true }
    } catch (error) {
        console.error("[WEBHOOK] Error sending callback:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        }
    }
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
            return NextResponse.json(
                { error: "Only PDF, PNG, JPG, and JPEG files are supported" },
                { status: 400 },
            )
        }

        // Get queue limit based on tier
        const queueLimit = QUEUE_LIMITS[tenant.tier as keyof typeof QUEUE_LIMITS] || QUEUE_LIMITS.free

        // Generate job ID
        const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        console.log(`[API] Created job ${jobId} for tenant ${tenant.name}`)

        // Parse the document
        console.log(`[API] Parsing document for job ${jobId}`)
        const parsedData = await parseDocument(file)

        // Store parsed data and job ID in database
        const db = await getDatabase()
        const jobsCollection = db.collection("parsing_jobs")

        const jobRecord = {
            job_id: jobId,
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            callback_url: callbackUrl,
            status: "completed",
            parsed_data: parsedData,
            created_at: new Date(),
            completed_at: new Date(),
            webhook_sent: false,
            webhook_attempts: 0,
            webhook_error: null,
        }

        const result = await jobsCollection.insertOne(jobRecord)
        console.log(`[API] Stored job record in database: ${result.insertedId}`)

        // Send webhook callback asynchronously (non-blocking)
        sendWebhookCallback(callbackUrl, jobId, parsedData, tenant.id)
            .then(async (webhookResult) => {
                // Update webhook status in database
                await jobsCollection.updateOne(
                    { job_id: jobId },
                    {
                        $set: {
                            webhook_sent: webhookResult.success,
                            webhook_error: webhookResult.error || null,
                            webhook_attempts: 1,
                        },
                    },
                )
            })
            .catch((error) => {
                console.error("[API] Error updating webhook status:", error)
            })

        // Return job ID immediately with success status
        return NextResponse.json(
            {
                job_id: jobId,
                status: "completed",
                message: "Document parsing completed. Webhook callback will be sent shortly.",
                callback_url: callbackUrl,
                queue_limit: queueLimit,
                database_id: result.insertedId.toString(),
            },
            { status: 202 },
        )
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

    try {
        const db = await getDatabase()
        const jobsCollection = db.collection("parsing_jobs")

        const job = await jobsCollection.findOne({ job_id: jobId })

        if (!job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 })
        }

        return NextResponse.json({
            job_id: job.job_id,
            status: job.status,
            file_name: job.file_name,
            parsed_data: job.parsed_data,
            webhook_sent: job.webhook_sent,
            webhook_error: job.webhook_error,
            created_at: job.created_at,
            completed_at: job.completed_at,
            callback_url: job.callback_url,
        })
    } catch (error) {
        console.error("[API] Error fetching job:", error)
        return NextResponse.json(
            { error: "Failed to fetch job details" },
            { status: 500 },
        )
    }
}