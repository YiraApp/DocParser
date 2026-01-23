"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { io, type Socket } from "socket.io-client"

interface DocumentStatusEvent {
  documentId: string
  status: "pending" | "processing" | "completed" | "failed"
  jobId?: string
  error?: string
  timestamp: string
}

interface UseDocumentStatusReturn {
  socket: Socket | null
  isConnected: boolean
  documentStatus: Map<string, DocumentStatusEvent>
  subscribeToDocument: (documentId: string, jobId: string) => void
  unsubscribeFromDocument: (documentId: string) => void
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"

export const useDocumentStatus = (): UseDocumentStatusReturn => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [documentStatus, setDocumentStatus] = useState<Map<string, DocumentStatusEvent>>(new Map())
  const subscribedDocsRef = useRef<Set<string>>(new Set())
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    console.log("[WEBSOCKET] Initializing Socket.IO connection to:", SOCKET_URL)

    const socketInstance: Socket = io(SOCKET_URL, {
      transports: ["websocket"], // WebSocket only, no polling
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      autoConnect: true,
    })

    socketInstance.on("connect", () => {
      console.log("? [WEBSOCKET] Connected to server:", socketInstance.id)
      setIsConnected(true)
    })

    socketInstance.on("disconnect", (reason) => {
      console.warn("? [WEBSOCKET] Disconnected:", reason)
      setIsConnected(false)
    })

    // ? UPDATED: Listen for document-status-update events
    socketInstance.on("document-status-update", (event: DocumentStatusEvent) => {
      console.log(`[WEBSOCKET] ?? Status update received for ${event.documentId}:`, event.status)
      setDocumentStatus((prev) => {
        const updated = new Map(prev)
        updated.set(event.documentId, event)
        return updated
      })
    })

    socketInstance.on("error", (error: any) => {
      console.error("[WEBSOCKET] Socket error:", error)
    })

    socketRef.current = socketInstance
    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [])

  const subscribeToDocument = useCallback(
    (documentId: string, jobId: string) => {
      if (!socketRef.current || !socketRef.current.connected) {
        console.warn(`[WEBSOCKET] Socket not connected, retrying subscription for ${documentId}...`)
        setTimeout(() => subscribeToDocument(documentId, jobId), 500)
        return
      }

      if (!subscribedDocsRef.current.has(documentId)) {
        console.log(`[WEBSOCKET] ?? Subscribing to document ${documentId} (Job: ${jobId})`)
        socketRef.current.emit("subscribe-document", { documentId, jobId })
        subscribedDocsRef.current.add(documentId)
      }
    },
    [],
  )

  const unsubscribeFromDocument = useCallback(
    (documentId: string) => {
      if (!socketRef.current) return

      if (subscribedDocsRef.current.has(documentId)) {
        console.log(`[WEBSOCKET] ?? Unsubscribing from document ${documentId}`)
        socketRef.current.emit("unsubscribe-document", { documentId })
        subscribedDocsRef.current.delete(documentId)
        setDocumentStatus((prev) => {
          const updated = new Map(prev)
          updated.delete(documentId)
          return updated
        })
      }
    },
    [],
  )

  return {
    socket: socketRef.current,
    isConnected,
    documentStatus,
    subscribeToDocument,
    unsubscribeFromDocument,
  }
}
