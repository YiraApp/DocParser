import { Server as SocketIOServer } from "socket.io"
import { Server as HTTPServer } from "http"
import { getDatabase } from "@/lib/db"

interface DocumentSubscription {
  documentId: string
  jobId: string
  userId?: string
}

export function initializeWebSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
    transports: ["websocket"], // WebSocket only
  })

  const subscriptions = new Map<string, DocumentSubscription[]>()

  io.on("connection", (socket) => {
    console.log(`? [WEBSOCKET] Client connected: ${socket.id}`)

    socket.on("subscribe-document", async (data: { documentId: string; jobId: string }) => {
      console.log(`[WEBSOCKET] Subscribing to document: ${data.documentId}`)

      if (!subscriptions.has(data.documentId)) {
        subscriptions.set(data.documentId, [])
      }

      subscriptions.get(data.documentId)!.push({
        documentId: data.documentId,
        jobId: data.jobId,
      })

      socket.join(`document-${data.documentId}`)
      console.log(`[WEBSOCKET] Socket ${socket.id} joined room: document-${data.documentId}`)
    })

    socket.on("unsubscribe-document", (data: { documentId: string }) => {
      console.log(`[WEBSOCKET] Unsubscribing from document: ${data.documentId}`)
      socket.leave(`document-${data.documentId}`)

      const subs = subscriptions.get(data.documentId)
      if (subs) {
        const index = subs.findIndex((s) => s.documentId === data.documentId)
        if (index > -1) {
          subs.splice(index, 1)
        }
        if (subs.length === 0) {
          subscriptions.delete(data.documentId)
        }
      }
    })

    socket.on("disconnect", () => {
      console.log(`? [WEBSOCKET] Client disconnected: ${socket.id}`)
    })

    socket.on("error", (error) => {
      console.error(`[WEBSOCKET] Socket error for ${socket.id}:`, error)
    })
  })

  // Function to emit document status updates from the API
  global.emitDocumentStatus = function (
    documentId: string,
    status: "pending" | "processing" | "completed" | "failed",
    error?: string,
  ) {
    const event = {
      documentId,
      status,
      error: error || undefined,
      timestamp: new Date().toISOString(),
    }

    console.log(`[WEBSOCKET] Broadcasting status update: ${documentId} -> ${status}`)
    io.to(`document-${documentId}`).emit("document-status-update", event)
  }

  return io
}

// Extend global to allow API routes to emit events
declare global {
  function emitDocumentStatus(
    documentId: string,
    status: "pending" | "processing" | "completed" | "failed",
    error?: string,
  ): void
}
