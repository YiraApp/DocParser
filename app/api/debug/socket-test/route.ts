import { type NextRequest, NextResponse } from "next/server"

/**
 * Test endpoint to verify WebSocket server and subscription functionality
 */
export async function GET(request: NextRequest) {
    try {
        const documentId = request.nextUrl.searchParams.get("documentId") || "test-doc-123"
        const jobId = request.nextUrl.searchParams.get("jobId") || "test-job-456"

        const io = (global as any).io

        if (!io) {
            return NextResponse.json({
                status: "error",
                message: "WebSocket server not initialized",
                suggestion: "Ensure server.js is running on port 3001",
            })
        }

        // Get subscription info
        const subscriptions = (global as any).subscriptions || new Map()
        const docSubscribers = subscriptions.get(documentId)

        return NextResponse.json({
            status: "success",
            websocketServer: {
                running: true,
                port: process.env.SOCKET_PORT || 3001,
                connectedClients: io.engine?.clientsCount || 0,
            },
            testData: {
                documentId,
                jobId,
                subscribers: docSubscribers?.size || 0,
            },
            instructions: {
                step1: "Open browser DevTools and check Network > WebSocket",
                step2: "Visit /socket-test in another tab or browser window",
                step3: "Click 'Subscribe' and watch for socket.io connection",
                step4: "Check server console for connection logs",
            },
        })
    } catch (error) {
        console.error("[SOCKET TEST] Error:", error)
        return NextResponse.json({
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
        })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { action, documentId, jobId } = await request.json()

        const io = (global as any).io

        if (!io) {
            return NextResponse.json({
                success: false,
                error: "WebSocket server not available",
            })
        }

        if (action === "broadcast") {
            // Broadcast test event
            io.emit("test-event", {
                documentId,
                message: "Test broadcast from API",
                timestamp: new Date().toISOString(),
            })

            return NextResponse.json({
                success: true,
                message: "Test event broadcast sent",
                action,
            })
        }

        if (action === "room-broadcast") {
            // Broadcast to specific room
            const roomName = `document-${documentId}`
            io.to(roomName).emit(`document-update-${documentId}`, {
                documentId,
                status: "test",
                message: "Test update for subscribed clients",
                timestamp: new Date().toISOString(),
            })

            return NextResponse.json({
                success: true,
                message: "Test event sent to room",
                room: roomName,
                action,
            })
        }

        return NextResponse.json({
            success: false,
            error: "Unknown action",
            availableActions: ["broadcast", "room-broadcast"],
        })
    } catch (error) {
        console.error("[SOCKET TEST POST] Error:", error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        })
    }
}
