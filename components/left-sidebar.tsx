"use client"
import type React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, FileText, Loader2, CheckCircle2, Zap, Clock, ChevronRight, AlertCircle, Search, X, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/lib/auth-context"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { initializeSocket } from "@/lib/socket-client"

interface LeftSidebarProps {
    onUploadSuccess: (document: any) => void
    onHistorySelect?: (document: any) => void
    onHistoryClickStart?: (docId: string) => void
    processingDocumentId?: string
    selectedDocumentId?: string
}

interface HistoryDocument {
    id: string
    job_id?: string
    file_name: string
    created_at: string
    structured_data: any
    user_email?: string
    user_name?: string
    status?: string
}

interface PaginationInfo {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
}

const PROCESSING_IDS_KEY = "yira_processing_ids"

export function LeftSidebar({
    onUploadSuccess,
    onHistorySelect,
    onHistoryClickStart,
    processingDocumentId,
    selectedDocumentId,
}: LeftSidebarProps) {
    const [file, setFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [progressMessage, setProgressMessage] = useState("")
    const [history, setHistory] = useState<HistoryDocument[]>([])
    const [isLoadingHistory, setIsLoadingHistory] = useState(true)
    const [showLimitDialog, setShowLimitDialog] = useState(false)
    const [filterQuery, setFilterQuery] = useState("")
    const [filterType, setFilterType] = useState<"name" | "email" | "user">("name")
    const [currentPage, setCurrentPage] = useState(1)
    const [pagination, setPagination] = useState<PaginationInfo | null>(null)
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
    const [currentlyOpenedDocId, setCurrentlyOpenedDocId] = useState<string | null>(null)
    const { user, incrementUploadCount, isAdmin } = useAuth()
    const hasReachedLimit = !(isAdmin ?? false) && (user?.uploadCount ?? 0) >= 10
    const currentPageRef = useRef(1)
    const isFetchingRef = useRef(false)
    const socketRef = useRef<any>(null)
    const openingDocRef = useRef<Set<string>>(new Set())
    const completedDocsRef = useRef<Set<string>>(new Set())
    const isHydratedRef = useRef(false)

    // ✅ Restore processing IDs from localStorage on mount
    useEffect(() => {
        if (isHydratedRef.current) return
        isHydratedRef.current = true

        try {
            const saved = localStorage.getItem(PROCESSING_IDS_KEY)
            if (saved) {
                const ids = JSON.parse(saved)
                if (Array.isArray(ids) && ids.length > 0) {
                    console.log("[SIDEBAR] 📦 Restoring processing IDs from localStorage:", ids)
                    setProcessingIds(new Set(ids))
                }
            }
        } catch (err) {
            console.error("[SIDEBAR] Error loading processing IDs:", err)
        }
    }, [])

    // ✅ Persist processing IDs to localStorage whenever they change
    useEffect(() => {
        const idsArray = Array.from(processingIds)
        console.log("[SIDEBAR] 💾 Saving processing IDs to localStorage:", idsArray)
        localStorage.setItem(PROCESSING_IDS_KEY, JSON.stringify(idsArray))
    }, [processingIds])

    // ✅ Sync processing IDs with database status immediately on mount
    useEffect(() => {
        const syncProcessingStatus = async () => {
            if (processingIds.size === 0 || !user) return

            try {
                console.log("[SIDEBAR] 🔄 Syncing processing IDs with database...")
                const response = await fetch(`/api/recent-documents?limit=100`, {
                    credentials: "include",
                })
                
                if (!response.ok) {
                    console.error("[SIDEBAR] Failed to fetch documents:", response.status)
                    return
                }

                const data = await response.json()
                const completedIds = new Set<string>()

                // ✅ Check each processing ID against database
                processingIds.forEach(docId => {
                    const dbDoc = data.documents?.find(
                        (d: any) => d.id === docId || d.job_id === docId
                    )

                    if (dbDoc) {
                        console.log(`[SIDEBAR] Database check - ${docId}: status="${dbDoc.status}"`)

                        // ✅ If status is NOT "pending", document is completed
                        if (dbDoc.status && dbDoc.status !== "pending") {
                            console.log(`[SIDEBAR] ✅ ${docId} is COMPLETED in database (status: ${dbDoc.status})`)
                            completedIds.add(docId)
                        }
                    }
                })

                // ✅ Remove all completed docs from processing IDs
                if (completedIds.size > 0) {
                    console.log(`[SIDEBAR] 🗑️ Removing ${completedIds.size} completed documents from localStorage`)
                    setProcessingIds(prev => {
                        const updated = new Set(prev)
                        completedIds.forEach(id => {
                            updated.delete(id)
                            console.log(`[SIDEBAR] ✅ Deleted ${id} from processing`)
                        })
                        return updated
                    })
                }
            } catch (err) {
                console.error("[SIDEBAR] Error syncing processing status:", err)
            }
        }

        // ✅ Sync immediately when component mounts
        syncProcessingStatus()
        
        // ✅ Also sync every 3 seconds while processing
        if (processingIds.size > 0) {
            const interval = setInterval(syncProcessingStatus, 3000)
            return () => clearInterval(interval)
        }
    }, [processingIds, user])

    // ✅ Initialize Socket.IO connection ONCE
    useEffect(() => {
        if (!user) return

        try {
            console.log("[SIDEBAR] 🚀 Initializing Socket.IO...")
            const socket = initializeSocket()
            socketRef.current = socket

            // Authenticate user once connected
            const handleConnect = () => {
                console.log("[SIDEBAR] ✅ Socket connected, authenticating...")
                socket.emit("user-join", {
                    userId: user.id,
                    userEmail: user.email,
                })

                // ✅ Re-subscribe to all processing documents after reconnect
                processingIds.forEach(docId => {
                    console.log(`[SIDEBAR] 📡 Re-subscribing to ${docId} after reconnect`)
                    socket.emit("subscribe-document", { docId })
                })
            }

            if (socket.connected) {
                handleConnect()
            } else {
                socket.on("connect", handleConnect)
            }

            // ✅ Listen for document completion - THIS IS THE KEY EVENT
            const handleDocumentCompleted = (data: any) => {
                const { docId } = data
                console.log(`[SIDEBAR] 🎉 SOCKET.IO EVENT: Document ${docId} completed!`)

                // ✅ Immediately remove from processing (webhook already updated DB)
                setProcessingIds(prev => {
                    const updated = new Set(prev)
                    updated.delete(docId)
                    console.log(`[SIDEBAR] ✅ Socket event removed ${docId} from processing IDs`)
                    return updated
                })

                // Update history
                setHistory(prev => {
                    return prev.map(doc => {
                        if (doc.id === docId || doc.job_id === docId) {
                            return { ...doc, status: "completed" }
                        }
                        return doc
                    })
                })

                // Unsubscribe
                socket.emit("unsubscribe-document", { docId })
            }

            socket.on("document-completed", handleDocumentCompleted)

            return () => {
                socket.off("connect", handleConnect)
                socket.off("document-completed", handleDocumentCompleted)
            }
        } catch (err) {
            console.error("[SIDEBAR] ❌ Socket.IO init failed:", err)
        }
    }, [user])

    // Fetch documents with pagination
    const fetchDocuments = useCallback(
        async (page: number = 1, skipLoading: boolean = false) => {
            if (!user) return
            if (isFetchingRef.current) return
            if (!skipLoading) {
                setIsLoadingHistory(true)
            }
            isFetchingRef.current = true

            try {
                const params = new URLSearchParams({
                    page: page.toString(),
                    limit: "5",
                })

                if (isAdmin && filterQuery.trim()) {
                    if (filterType === "email") {
                        params.append("filterEmail", filterQuery)
                    } else if (filterType === "user") {
                        params.append("filterUser", filterQuery)
                    } else {
                        params.append("filterName", filterQuery)
                    }
                }

                const response = await fetch(`/api/recent-documents?${params}`, {
                    credentials: "include",
                })

                if (!response.ok) return

                const data = await response.json()

                const filteredDocuments = (data.documents || []).map(
                    (doc: HistoryDocument) =>
                        doc.status === "pending" ? doc : { ...doc, status: undefined }
                )

                setHistory(filteredDocuments)
                setPagination(data.pagination)
                setCurrentPage(page)
                currentPageRef.current = page
            } catch (err) {
                console.error("[SIDEBAR] Error fetching documents:", err)
            } finally {
                isFetchingRef.current = false
                if (!skipLoading) {
                    setIsLoadingHistory(false)
                }
            }
        },
        [user, isAdmin, filterQuery, filterType]
    )

    // ✅ SINGLE effect for mount - NO fetchDocuments dependency
    useEffect(() => {
        if (!user) return
        fetchDocuments(1)
    }, [user])

    // ✅ SINGLE effect for filter changes - with debounce
    useEffect(() => {
        if (!isAdmin) return
        const timer = setTimeout(() => fetchDocuments(1), 500)
        return () => clearTimeout(timer)
    }, [filterQuery, filterType, isAdmin, fetchDocuments])

    // ✅ Open document - NO API CALL
    const openDocument = useCallback(
        async (doc: HistoryDocument) => {
            if (!onHistorySelect) return

            if (openingDocRef.current.has(doc.id)) {
                console.log(`[SIDEBAR] ⏭️  Already opening ${doc.id}`)
                return
            }

            openingDocRef.current.add(doc.id)

            try {
                console.log(`[SIDEBAR] 📂 Opening document ${doc.id} from local cache (NO API CALL)`)
                onHistorySelect({
                    id: doc.id,
                    fileName: doc.file_name,
                    fileUrl: undefined,
                    uploadedAt: doc.created_at,
                    documentType: "Medical Document",
                    fields: [],
                    summary: "",
                    notes: [],
                    structuredData: doc.structured_data || {},
                    confidenceScore: undefined,
                    healthRecommendations: undefined,
                    fraudDetection: null,
                    jobId: doc.job_id,
                })
                setCurrentlyOpenedDocId(doc.id)
                console.log(`[SIDEBAR] ✅ Document ${doc.id} opened from cache`)
            } catch (error) {
                console.error("[SIDEBAR] Error opening document:", error)
                onHistorySelect({
                    id: doc.id,
                    fileName: doc.file_name,
                    structuredData: doc.structured_data || {},
                    uploadedAt: doc.created_at,
                    documentType: "Medical Document",
                    fields: [],
                    summary: "",
                    notes: [],
                    jobId: doc.job_id,
                })
                setCurrentlyOpenedDocId(doc.id)
            } finally {
                openingDocRef.current.delete(doc.id)
            }
        },
        [onHistorySelect]
    )

    // ✅ Handle history click
    const handleHistoryClick = useCallback(
        async (doc: HistoryDocument) => {
            const isProcessing =
                processingDocumentId === doc.id ||
                doc.status === "pending" ||
                processingIds.has(doc.id)

            if (isProcessing) return

            onHistoryClickStart?.(doc.id)
            await openDocument(doc)
        },
        [onHistoryClickStart, openDocument, processingDocumentId, processingIds]
    )

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)
        if (minutes < 60) return `${minutes}m ago`
        if (hours < 24) return `${hours}h ago`
        if (days < 7) return `${days}d ago`
        return date.toLocaleDateString()
    }

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            setIsDragging(false)
            if (hasReachedLimit) {
                setShowLimitDialog(true)
                return
            }
            const droppedFile = e.dataTransfer.files[0]
            if (droppedFile) {
                setFile(droppedFile)
            }
        },
        [hasReachedLimit]
    )

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (hasReachedLimit) {
            setShowLimitDialog(true)
            e.target.value = ""
            return
        }
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            const validTypes = [
                "image/png",
                "image/jpeg",
                "image/jpg",
                "application/pdf",
            ]
            if (!validTypes.includes(selectedFile.type)) {
                alert(
                    "Only image files (PNG, JPG, JPEG) and PDF documents are supported."
                )
                return
            }
            setFile(selectedFile)
        }
    }

    // ✅ Handle Upload Success
    const handleUpload = async () => {
        if (hasReachedLimit) {
            setShowLimitDialog(true)
            return
        }
        if (!file) {
            alert("Please select a file to upload")
            return
        }

        const validTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"]
        if (!validTypes.includes(file.type)) {
            alert("Only image files (PNG, JPG, JPEG) and PDF documents are supported.")
            return
        }

        setIsUploading(true)
        setUploadProgress(0)
        setProgressMessage("Starting...")

        try {
            setUploadProgress(20)
            setProgressMessage("Uploading file...")

            const formData = new FormData()
            formData.append("file", file)

            setUploadProgress(50)

            const response = await fetch("/api/upload-wrapper", {
                method: "POST",
                headers: {
                    "x-user-email": user?.email || "anonymous",
                    "x-user-id": user?.id || "anonymous",
                    "x-user-role": user?.role || "user",
                },
                body: formData,
            })

            setProgressMessage("Processing with AI...")
            setUploadProgress(75)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Upload failed" }))
                throw new Error(errorData.error || "Upload failed")
            }

            const data = await response.json()
            setProgressMessage("Complete!")
            setUploadProgress(100)
            await new Promise(resolve => setTimeout(resolve, 500))

            const processingDocument = {
                id: data.id,
                fileName: file.name,
                uploadedAt: new Date().toISOString(),
                documentType: "Medical Document",
                fields: [],
                summary: "",
                notes: [],
                structuredData: {},
                jobId: data.job_id,
                reportId: data.report_id,
                status: "processing",
            }

            incrementUploadCount()
            setFile(null)
            setUploadProgress(0)
            setProgressMessage("")

            await fetchDocuments(currentPageRef.current, true)

            // ✅ Subscribe to document updates via Socket.IO (NOT API CALL)
            const docIdToSubscribe = data.id || data.job_id
            console.log(`[SIDEBAR] 📡 Subscribing to socket updates for: ${docIdToSubscribe}`)

            // Add to processing IDs FIRST (this persists to localStorage)
            setProcessingIds(prev => {
                const updated = new Set(prev)
                updated.add(docIdToSubscribe)
                console.log(`[SIDEBAR] ✅ Added ${docIdToSubscribe} to processing IDs`)
                return updated
            })

            // Then subscribe to socket
            if (socketRef.current?.connected) {
                socketRef.current.emit("subscribe-document", { docId: docIdToSubscribe })
            } else {
                socketRef.current?.once("connect", () => {
                    socketRef.current?.emit("subscribe-document", { docId: docIdToSubscribe })
                })
            }

            onUploadSuccess(processingDocument)
        } catch (error) {
            alert(error instanceof Error ? error.message : "Failed to upload. Please try again.")
            setProgressMessage("")
            setUploadProgress(0)
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <>
            <aside className="w-80 h-[calc(100vh-64px)] overflow-hidden bg-gradient-to-b from-background to-muted/10 border-r border-border/40 flex flex-col z-10">
                <ScrollArea className="h-full w-full">
                    <div className="p-4 space-y-4">
                        {!isAdmin && (
                            <Card
                                className={cn(
                                    "border p-2",
                                    hasReachedLimit
                                        ? "border-destructive/50 bg-destructive/5"
                                        : "border-border/50 bg-muted/20"
                                )}
                            >
                                <div className="flex items-center gap-2 text-xs">
                                    <AlertCircle
                                        className={cn(
                                            "w-3 h-3",
                                            hasReachedLimit
                                                ? "text-destructive"
                                                : "text-muted-foreground"
                                        )}
                                    />
                                    <span
                                        className={cn(
                                            "font-medium",
                                            hasReachedLimit
                                                ? "text-destructive"
                                                : "text-foreground"
                                        )}
                                    >
                                        {hasReachedLimit
                                            ? "Upload limit reached (10/10)"
                                            : `${user?.uploadCount || 0}/10 uploads used`}
                                    </span>
                                </div>
                            </Card>
                        )}

                        <Card className="border border-primary/20 shadow-lg bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
                            <div className="p-2 space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                                        <Upload className="w-3 h-3 text-primary" />
                                    </div>
                                    <h3 className="text-xs font-semibold text-foreground">
                                        Upload New Document
                                    </h3>
                                </div>

                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={cn(
                                        "relative border-2 border-dashed rounded-lg p-3 text-center transition-all",
                                        isDragging
                                            ? "border-primary bg-primary/10 scale-[1.01]"
                                            : "border-border/50 bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
                                    )}
                                >
                                    <input
                                        type="file"
                                        id="file-upload"
                                        className="hidden"
                                        onChange={handleFileSelect}
                                        accept="image/png,image/jpeg,image/jpg,application/pdf"
                                    />
                                    <div className="flex flex-col items-center gap-2">
                                        {file ? (
                                            <>
                                                <div className="relative">
                                                    <div className="p-2 rounded-xl bg-primary/10 border border-primary/30">
                                                        <FileText className="w-6 h-6 text-primary" />
                                                    </div>
                                                    <div className="absolute -top-1 -right-1 p-1 rounded-full bg-accent">
                                                        <CheckCircle2 className="w-3 h-3 text-accent-foreground" />
                                                    </div>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-xs font-semibold text-foreground truncate max-w-[200px]">
                                                        {file.name}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {(
                                                            file.size /
                                                            1024 /
                                                            1024
                                                        ).toFixed(2)}{" "}
                                                        MB
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="p-2 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-border/50">
                                                    <Upload className="w-6 h-6 text-primary" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-xs font-semibold text-foreground">
                                                        Drop file here
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        or click to browse
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                        <Button
                                            type="button"
                                            variant={file ? "outline" : "secondary"}
                                            size="sm"
                                            className="mt-1 h-7 px-3 text-xs"
                                            onClick={() =>
                                                document
                                                    .getElementById("file-upload")
                                                    ?.click()
                                            }
                                        >
                                            {file ? "Change File" : "Browse Files"}
                                        </Button>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleUpload}
                                    disabled={!file || isUploading}
                                    className="w-full h-8 text-xs gap-2"
                                >
                                    {isUploading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {progressMessage || "Processing..."}
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="w-4 h-4" />
                                            Parse Document
                                        </>
                                    )}
                                </Button>
                            </div>
                        </Card>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Clock className="w-3 h-3 text-muted-foreground" />
                                <h3 className="text-xs font-semibold text-foreground">
                                    Recent Documents
                                </h3>
                            </div>

                            {isAdmin && (
                                <Card className="border border-border/50 bg-muted/20 p-2">
                                    <div className="space-y-2">
                                        <Tabs
                                            defaultValue="name"
                                            value={filterType}
                                            onValueChange={value =>
                                                setFilterType(
                                                    value as
                                                    | "name"
                                                    | "email"
                                                    | "user"
                                                )
                                            }
                                        >
                                            <TabsList className="grid w-full grid-cols-3 h-7">
                                                <TabsTrigger
                                                    value="name"
                                                    className="text-xs"
                                                >
                                                    File Name
                                                </TabsTrigger>
                                                <TabsTrigger
                                                    value="user"
                                                    className="text-xs"
                                                >
                                                    User Name
                                                </TabsTrigger>
                                                <TabsTrigger
                                                    value="email"
                                                    className="text-xs"
                                                >
                                                    Email
                                                </TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                            <Input
                                                placeholder={
                                                    filterType === "name"
                                                        ? "Search by filename..."
                                                        : filterType === "user"
                                                            ? "Search by user name..."
                                                            : "Search by email..."
                                                }
                                                value={filterQuery}
                                                onChange={e =>
                                                    setFilterQuery(e.target.value)
                                                }
                                                className="pl-7 h-7 text-xs"
                                            />
                                            {filterQuery && (
                                                <button
                                                    onClick={() =>
                                                        setFilterQuery("")
                                                    }
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                        {pagination && (
                                            <div className="text-[10px] text-muted-foreground space-y-1">
                                                <div>
                                                    Found:{" "}
                                                    <span className="font-semibold">
                                                        {pagination.total}
                                                    </span>{" "}
                                                    total documents
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            )}

                            {isLoadingHistory ? (
                                <Card className="border border-border/50">
                                    <div className="p-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Loading documents...
                                    </div>
                                </Card>
                            ) : history.length > 0 ? (
                                <div className="space-y-1">
                                    {history.map(doc => {
                                        const isProcessing =
                                            processingDocumentId === doc.id ||
                                            doc.status === "pending" ||
                                            processingIds.has(doc.id)
                                        const isCurrentlyOpen =
                                            currentlyOpenedDocId === doc.id

                                        return (
                                            <Card
                                                key={doc.id}
                                                className={cn(
                                                    "border hover:border-primary/50 hover:bg-accent/5 transition-all py-2 group min-h-[40px]",
                                                    isProcessing
                                                        ? "cursor-not-allowed opacity-75"
                                                        : "cursor-pointer",
                                                    isCurrentlyOpen
                                                        ? "border-primary bg-primary/5"
                                                        : "border-border/50"
                                                )}
                                                onClick={() =>
                                                    handleHistoryClick(doc)
                                                }
                                            >
                                                <div className="p-2 flex items-center gap-2">
                                                    <div className="p-1.5 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                                                        {isProcessing ? (
                                                            <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />
                                                        ) : (
                                                            <FileText className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium text-foreground truncate max-w-[180px]">
                                                            {doc.file_name}
                                                        </p>
                                                        {isAdmin &&
                                                            doc.user_name && (
                                                                <p className="text-[10px] text-muted-foreground truncate">
                                                                    {
                                                                        doc.user_name
                                                                    }
                                                                </p>
                                                            )}
                                                        {isAdmin &&
                                                            doc.user_email && (
                                                                <p className="text-[10px] text-muted-foreground truncate">
                                                                    {
                                                                        doc.user_email
                                                                    }
                                                                </p>
                                                            )}
                                                        <div className="flex items-center gap-1">
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {formatDate(
                                                                    doc.created_at
                                                                )}
                                                            </p>
                                                            {isProcessing && (
                                                                <Badge
                                                                    variant="secondary"
                                                                    className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 border-0"
                                                                >
                                                                    In Progress
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                                </div>
                                            </Card>
                                        )
                                    })}
                                </div>
                            ) : null}

                            {pagination &&
                                pagination.totalPages > 1 &&
                                history.length > 0 && (
                                    <Card className="border border-border/50 bg-muted/20 p-2">
                                        <div className="flex items-center justify-between gap-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2"
                                                disabled={
                                                    !pagination.hasPrevPage
                                                }
                                                onClick={() =>
                                                    fetchDocuments(
                                                        currentPage - 1
                                                    )
                                                }
                                            >
                                                <ChevronLeft className="w-3 h-3" />
                                            </Button>
                                            <div className="text-[10px] text-muted-foreground whitespace-nowrap flex-1 text-center">
                                                Page{" "}
                                                <span className="font-semibold">
                                                    {pagination.page}
                                                </span>{" "}
                                                of{" "}
                                                <span className="font-semibold">
                                                    {pagination.totalPages}
                                                </span>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2"
                                                disabled={
                                                    !pagination.hasNextPage
                                                }
                                                onClick={() =>
                                                    fetchDocuments(
                                                        currentPage + 1
                                                    )
                                                }
                                            >
                                                <ChevronRight className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </Card>
                                )}

                            {!isLoadingHistory && history.length === 0 && (
                                <Card className="border border-border/50 bg-muted/20">
                                    <div className="p-3 text-center text-xs text-muted-foreground">
                                        {isAdmin && filterQuery
                                            ? "No documents match your filter"
                                            : "No recent documents"}
                                    </div>
                                </Card>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </aside>

            <Dialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload Limit Reached</DialogTitle>
                        <DialogDescription className="space-y-2 pt-1">
                            <p className="text-xs">
                                You have reached your upload limit of 10
                                documents.
                            </p>
                            <p className="text-xs text-foreground">
                                To upload more documents, please contact our
                                sales team at{" "}
                                <a
                                    href="mailto:sales@yira.ai"
                                    className="text-primary hover:underline"
                                >
                                    sales@yira.ai
                                </a>{" "}
                                or upgrade your plan.
                            </p>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end">
                        <Button onClick={() => setShowLimitDialog(false)}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}