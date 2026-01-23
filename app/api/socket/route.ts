import { type NextRequest, NextResponse } from "next/server"

/**
 * API endpoint for emitting WebSocket events from Next.js routes
 * This allows server-side code to push updates to connected clients
 */
export async function POST(request: NextRequest) {
    try {
        const { documentId, status, error, data } = await request.json()

        if (!documentId) {
            return NextResponse.json(
                { error: "Missing documentId" },
                { status: 400 }
            )
        }

        console.log(`[SOCKET API] Emitting event for document: ${documentId}`, { status, error })

        // Try to get the global io instance
        const io = (global as any).io

        if (!io) {
            console.warn("[SOCKET API] ?? Socket.IO server not available")
            return NextResponse.json(
                {
                    success: false,
                    message: "WebSocket server not initialized",
                    queued: true, // Client should poll
                },
                { status: 503 }
            )
        }

        // Emit to specific room
        const roomName = `document-${documentId}`
        console.log(`[SOCKET API] Broadcasting to room: ${roomName}`)

        io.to(roomName).emit(`document-update-${documentId}`, {
            documentId,
            status,
            error,
            data,
            timestamp: new Date().toISOString(),
        })

        return NextResponse.json({
            success: true,
            message: "Event emitted successfully",
            room: roomName,
        })
    } catch (error) {
        console.error("[SOCKET API] Error:", error)
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Internal error",
            },
            { status: 500 }
        )
    }
}

/**
 * GET endpoint for checking WebSocket connection status
 */
export async function GET(request: NextRequest) {
    try {
        const io = (global as any).io

        const status = {
            websocketAvailable: !!io,
            connectedClients: io?.engine?.clientsCount || 0,
            timestamp: new Date().toISOString(),
        }

        console.log("[SOCKET API] Status check:", status)

        return NextResponse.json(status)
    } catch (error) {
        console.error("[SOCKET API GET] Error:", error)
        return NextResponse.json(
            { error: "Internal error" },
            { status: 500 }
        )
    }
}
