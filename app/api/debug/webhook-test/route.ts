import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-server"

/**
 * Debug endpoint for testing webhook and WebSocket integration
 * 
 * GET /api/debug/webhook-test - Get test utilities
 * POST /api/debug/webhook-test - Send test webhook
 */

export async function GET(request: NextRequest) {
    try {
        const sessionUser = await getSessionUser(request)
        if (!sessionUser?.isAdmin) {
            return NextResponse.json(
                { error: "Admin only" },
                { status: 403 }
            )
        }

        return NextResponse.json({
            success: true,
            message: "Webhook test utilities available",
            usage: {
                testWebhook: "POST /api/debug/webhook-test",
                sendTestWebhook: "POST with optional { documentId, patientName }",
            },
        })
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to retrieve test info" },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const sessionUser = await getSessionUser(request)
        if (!sessionUser?.isAdmin) {
            return NextResponse.json(
                { error: "Admin only" },
                { status: 403 }
            )
        }

        const body = await request.json()
        const { documentId = 'debug-' + Date.now(), patientName = 'Debug Patient' } = body

        console.log(`[DEBUG WEBHOOK] Sending test webhook: ${documentId}`)

        // Call the webhook endpoint directly
        const webhookResponse = await fetch(
            new URL("/api/webhook", request.url),
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    job_id: documentId,
                    report_id: `debug-report-${documentId}`,
                    tenant_id: "debug-tenant",
                    project_id: "debug-project",
                    status: "completed",
                    timestamp: new Date().toISOString(),
                    parsed_data: {
                        patient_name: patientName,
                        diagnosis: "Debug Test Diagnosis",
                        clinician_name: "Dr. Debug",
                        encounter_date: new Date().toISOString().split('T')[0],
                        lab_results: [
                            {
                                examination_name: "Debug Lab Results",
                                tests: [
                                    {
                                        test_name: "Debug Test 1",
                                        result: "100",
                                        unit: "units",
                                        reference_range: "80-120",
                                        status: "normal",
                                    },
                                    {
                                        test_name: "Debug Test 2",
                                        result: "50",
                                        unit: "percent",
                                        reference_range: "40-60",
                                        status: "normal",
                                    },
                                ],
                            },
                        ],
                        medical_history_questions: [
                            { question: "Do you have allergies?", answer: "No" },
                            { question: "Any surgeries?", answer: "No" },
                        ],
                    },
                }),
            }
        )

        if (!webhookResponse.ok) {
            throw new Error(`Webhook failed: ${webhookResponse.status}`)
        }

        const webhookData = await webhookResponse.json()

        console.log(`[DEBUG WEBHOOK] ? Test webhook sent successfully`)

        return NextResponse.json({
            success: true,
            message: "Test webhook sent successfully",
            documentId,
            webhookResult: webhookData,
            instructions: [
                "1. Check browser console for [WEBSOCKET] logs",
                "2. Monitor the Recent Documents sidebar",
                "3. Watch for status change from processing to completed",
                "4. Look for network tab to see WebSocket events",
            ],
        })
    } catch (error) {
        console.error("[DEBUG WEBHOOK] Error:", error)
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to send test webhook",
            },
            { status: 500 }
        )
    }
}
