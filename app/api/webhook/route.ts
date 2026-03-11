import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"
import { ObjectId } from "mongodb"

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

// Helper: Safely convert any value to string
function safeStringify(value: any): string {
    if (value === null || value === undefined) return ""
    if (typeof value === "string") return value
    if (typeof value === "object") {
        if (Array.isArray(value)) {
            return value.map(v => safeStringify(v)).join(", ")
        }
        if (value.mr_no) return String(value.mr_no)
        if (value.reg_no) return String(value.reg_no)
        if (value.question && value.answer) return `Q: ${value.question}\nA: ${value.answer}`
        return JSON.stringify(value)
    }
    return String(value)
}

function extractVitalSigns(parsedData: any) {
    const vitalSigns: Record<string, any> = {}

    if (parsedData.lab_results && Array.isArray(parsedData.lab_results)) {
        parsedData.lab_results.forEach((exam: any) => {
            if (exam.examination_name === "Vitals and Body Composition" && exam.tests) {
                exam.tests.forEach((test: any) => {
                    const testName = test.test_name.toLowerCase()
                    if (testName.includes("blood pressure")) {
                        vitalSigns.bloodPressure = test.result
                    } else if (testName.includes("heart rate")) {
                        vitalSigns.heartRate = test.result
                    } else if (testName.includes("temperature")) {
                        vitalSigns.temperature = test.result
                    } else if (testName.includes("oxygen saturation")) {
                        vitalSigns.oxygenSaturation = test.result
                    }
                })
            }
        })
    }

    return vitalSigns
}

function buildDocumentSummary(parsedData: any): string {
    const lines: string[] = []
    if (parsedData.patient_name) lines.push(`Patient: ${parsedData.patient_name}`)
    if (parsedData.encounter_date) lines.push(`Encounter Date: ${parsedData.encounter_date}`)
    if (parsedData.clinician_name) lines.push(`Clinician: ${parsedData.clinician_name}`)
    if (parsedData.diagnosis) lines.push(`Diagnosis: ${parsedData.diagnosis}`)
    return lines.join("\n")
}

export async function POST(request: NextRequest) {
    console.log("[WEBHOOK POST] ===== WEBHOOK RECEIVED =====")

    try {
        const payload = await request.json()

        console.log("[WEBHOOK POST] Payload:", {
            job_id: payload.job_id,
            status: payload.status,
            has_parsed_data: !!payload.parsed_data,
        })

        if (!payload.job_id) {
            console.error("[WEBHOOK POST] ❌ Missing job_id")
            return NextResponse.json(
                { error: "Invalid webhook payload - missing job_id" },
                { status: 400 }
            )
        }

        const db = await getDatabase()
        const jobCollection = db.collection("job_ids")
        const webhookCollection = db.collection("webhook_responses")

        // Fetch user info from job record
        const jobRecord = await jobCollection.findOne({ job_id: payload.job_id })
        if (!jobRecord) {
            console.warn("[WEBHOOK POST] ⚠️ Job record not found")
            return NextResponse.json(
                { error: "Job record not found" },
                { status: 404 }
            )
        }

        const userId = jobRecord.user_id || "anonymous"
        const userEmail = jobRecord.user_email || "anonymous"

        // ✅ SAVE TO WEBHOOK_RESPONSES
        console.log("[WEBHOOK POST] 💾 Saving webhook response")
        const webhookResult = await webhookCollection.insertOne({
            job_id: payload.job_id,
            report_id: payload.report_id || payload.job_id,
            tenant_id: payload.tenant_id || "unknown",
            project_id: payload.project_id || "unknown",
            status: payload.status || "completed",
            parsed_data: payload.parsed_data || null,
            fraud_detection: payload.fraud_detection || null,
            timestamp: payload.timestamp || new Date().toISOString(),
            received_at: new Date(),
        })

        console.log("[WEBHOOK POST] ✅ Webhook saved:", webhookResult.insertedId)

        // ✅ UPDATE JOB RECORD STATUS
        await jobCollection.updateOne(
            { job_id: payload.job_id },
            {
                $set: {
                    status: payload.status || "completed",
                    updated_at: new Date(),
                },
            }
        )

        console.log("[WEBHOOK POST] ✅ Job record updated to status:", payload.status)

        // ✅ NOTIFY CLIENT VIA SOCKET.IO
        if ((global as any).notifyDocumentCompletion) {
            console.log(`[WEBHOOK POST] 📡 Sending Socket.IO notification for job_id: ${payload.job_id}`)
                ; (global as any).notifyDocumentCompletion(userId, payload.job_id)
        } else {
            console.warn("[WEBHOOK POST] ⚠️ notifyDocumentCompletion not available")
        }

        return NextResponse.json(
            {
                success: true,
                message: "Webhook processed successfully",
                job_id: payload.job_id,
            },
            { status: 200 }
        )
    } catch (error) {
        console.error("[WEBHOOK POST] ❌ Error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed" },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    try {
        const db = await getDatabase()
        const webhookCollection = db.collection("webhook_responses")
        const jobCollection = db.collection("job_ids")

        const sessionUser = await getSessionUser(request)
        if (!sessionUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const jobId = request.nextUrl.searchParams.get("job_id")

        if (jobId) {
            const webhook = await webhookCollection.findOne({ job_id: jobId })
            if (!webhook) {
                return NextResponse.json({ error: "Not found" }, { status: 404 })
            }

            const job = await jobCollection.findOne({ job_id: jobId })
            if (job?.user_email !== sessionUser.email && !sessionUser.isAdmin) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
            }

            return NextResponse.json({
                success: true,
                webhook: {
                    id: webhook._id.toString(),
                    job_id: webhook.job_id,
                    report_id: webhook.report_id,
                    status: webhook.status,
                    parsed_data: webhook.parsed_data,
                    fraud_detection: webhook.fraud_detection || null,
                    timestamp: webhook.timestamp,
                },
            })
        }

        const userFilter = sessionUser.isAdmin ? {} : { email: sessionUser.email }
        const recentWebhooks = await webhookCollection
            .find(userFilter)
            .sort({ received_at: -1 })
            .limit(20)
            .toArray()

        return NextResponse.json({
            success: true,
            webhooks: recentWebhooks.map((w: any) => ({
                id: w._id.toString(),
                job_id: w.job_id,
                report_id: w.report_id,
                status: w.status,
                fraud_detection: w.fraud_detection || null,
                timestamp: w.timestamp,
            })),
            count: recentWebhooks.length,
        })
    } catch (error) {
        console.error("[WEBHOOK GET] Error:", error)
        return NextResponse.json({ error: "Failed" }, { status: 500 })
    }
}