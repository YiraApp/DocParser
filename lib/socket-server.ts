import { Server as IOServer, Socket } from "socket.io"
import { IncomingMessage } from "http"
import { Socket as NetSocket } from "net"

let ioInstance: IOServer | null = null

interface CustomSocket extends Socket {
    userId?: string
    userEmail?: string
}

const users = new Map<string, CustomSocket>()

export function initializeSocketServer(
    server: any
): IOServer {
    if (ioInstance) return ioInstance

    ioInstance = new IOServer(server, {
        cors: {
            origin: process.env.NEXT_PUBLIC_BASE_URL || "*",
            methods: ["GET", "POST"],
            credentials: true,
        },
        transports: ["websocket", "polling"],
    })

    ioInstance.on("connection", (socket: CustomSocket) => {
        console.log(`[SOCKET.IO] ✅ User connected: ${socket.id}`)

        // User authentication and join
        socket.on("user-join", (data: { userId: string; userEmail: string }) => {
            socket.userId = data.userId
            socket.userEmail = data.userEmail
            users.set(data.userId, socket)
            console.log(`[SOCKET.IO] User ${data.userId} authenticated`)
        })

        // Subscribe to document updates
        socket.on("subscribe-document", (data: { docId: string }) => {
            socket.join(`doc:${data.docId}`)
            console.log(`[SOCKET.IO] User subscribed to doc:${data.docId}`)
        })

        // Unsubscribe from document
        socket.on("unsubscribe-document", (data: { docId: string }) => {
            socket.leave(`doc:${data.docId}`)
            console.log(`[SOCKET.IO] User unsubscribed from doc:${data.docId}`)
        })

        socket.on("disconnect", () => {
            if (socket.userId) {
                users.delete(socket.userId)
                console.log(`[SOCKET.IO] User ${socket.userId} disconnected`)
            }
        })

        socket.on("error", (error: any) => {
            console.error(`[SOCKET.IO] Error from ${socket.id}:`, error)
        })
    })

    return ioInstance
}

export function getSocketServer(): IOServer | null {
    return ioInstance
}

// Notify a specific user about document completion
export function notifyDocumentCompletion(userId: string, docId: string) {
    if (!ioInstance) {
        console.warn("[SOCKET.IO] Server not initialized")
        return
    }

    ioInstance.to(`doc:${docId}`).emit("document-completed", {
        docId,
        timestamp: new Date().toISOString(),
    })

    console.log(`[SOCKET.IO] 📤 Notified about completion of doc:${docId}`)
}

export function getUserSocket(userId: string): CustomSocket | undefined {
    return users.get(userId)
}