import { createServer } from "http"
import { Server as IOServer, Socket } from "socket.io"
import next from "next"
import path from "path"

const dev = process.env.NODE_ENV !== "production"
const app = next({ dev, dir: path.join(process.cwd()) })
const handle = app.getRequestHandler()

const PORT = parseInt(process.env.PORT || "3000", 10)

interface CustomSocket extends Socket {
    userId?: string
    userEmail?: string
}

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        handle(req, res)
    })

    // ✅ Create Socket.IO server BEFORE listening
    const io = new IOServer(httpServer, {
        cors: {
            origin: process.env.NEXT_PUBLIC_BASE_URL || "*",
            methods: ["GET", "POST"],
            credentials: true,
        },
        path: "/socket.io",
        transports: ["websocket", "polling"],
    })

    // Store active user connections
    const userSockets = new Map<string, CustomSocket>()
    const documentSubscriptions = new Map<string, Set<string>>() // docId -> Set<socketIds>

    io.on("connection", (socket: CustomSocket) => {
        console.log(`[SOCKET.IO] ✅ Client connected: ${socket.id}`)

        // User authentication
        socket.on("user-join", (data: { userId: string; userEmail: string }) => {
            userSockets.set(data.userId, socket)
            socket.userId = data.userId
            socket.userEmail = data.userEmail
            console.log(`[SOCKET.IO] 👤 User authenticated: ${data.userId} (${socket.id})`)
        })

        // Subscribe to document updates
        socket.on("subscribe-document", (data: { docId: string }) => {
            const { docId } = data
            socket.join(`doc:${docId}`)
            
            // Track subscription
            if (!documentSubscriptions.has(docId)) {
                documentSubscriptions.set(docId, new Set())
            }
            documentSubscriptions.get(docId)?.add(socket.id)
            
            console.log(`[SOCKET.IO] 📡 Client subscribed to doc:${docId} (${socket.id})`)
        })

        // Unsubscribe from document
        socket.on("unsubscribe-document", (data: { docId: string }) => {
            const { docId } = data
            socket.leave(`doc:${docId}`)

            // Remove subscription
            documentSubscriptions.get(docId)?.delete(socket.id)

            console.log(`[SOCKET.IO] 📴 Client unsubscribed from doc:${docId} (${socket.id})`)
        })

        socket.on("disconnect", () => {
            // Clean up subscriptions
            for (const [docId, sockets] of documentSubscriptions.entries()) {
                sockets.delete(socket.id)
                if (sockets.size === 0) {
                    documentSubscriptions.delete(docId)
                }
            }

            // Remove user
            if (socket.userId) {
                userSockets.delete(socket.userId)
            }

            console.log(`[SOCKET.IO] 🔌 Client disconnected: ${socket.id}`)
        })

        socket.on("error", (error: any) => {
            console.error(`[SOCKET.IO] ❌ Socket error (${socket.id}):`, error)
        })
    })

        // ✅ Export global notification function for webhook
        ; (global as any).notifyDocumentCompletion = (userId: string, docId: string) => {
            try {
                console.log(`[SOCKET.IO] 📤 Broadcasting document-completed for docId: ${docId}`)
                io.to(`doc:${docId}`).emit("document-completed", {
                    docId,
                    timestamp: new Date().toISOString(),
                })
                console.log(`[SOCKET.IO] ✅ Notified subscribers of doc:${docId}`)
            } catch (error) {
                console.error(`[SOCKET.IO] ❌ Failed to notify:`, error)
            }
        }

    httpServer.listen(PORT, "0.0.0.0", () => {
        console.log(`✅ Server running on http://localhost:${PORT}`)
        console.log(`📡 Socket.IO available at ws://localhost:${PORT}/socket.io`)
    })

    httpServer.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
            console.error(`❌ Port ${PORT} is already in use`)
            process.exit(1)
        } else {
            console.error("❌ Server error:", err)
        }
    })
})