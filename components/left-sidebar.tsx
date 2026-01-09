"use client"
import type React from "react"
import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, FileText, Loader2, CheckCircle2, Zap, Clock, ChevronRight, AlertCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/lib/auth-context"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface LeftSidebarProps {
    onUploadSuccess: (document: any) => void
    onHistorySelect?: (document: any) => void
}

interface HistoryDocument {
    id: string
    file_name: string
    created_at: string
    structured_data: any
}

export function LeftSidebar({ onUploadSuccess, onHistorySelect }: LeftSidebarProps) {
    const [file, setFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [progressMessage, setProgressMessage] = useState("")
    const [history, setHistory] = useState<HistoryDocument[]>([])
    const [isLoadingHistory, setIsLoadingHistory] = useState(true)
    const [showLimitDialog, setShowLimitDialog] = useState(false)
    const { user, incrementUploadCount, isAdmin } = useAuth()
    const hasReachedLimit = !(isAdmin ?? false) && (user?.uploadCount ?? 0) >= 10

    // Fetch recent documents on component mount and when user changes
    useEffect(() => {
        const fetchRecentDocuments = async () => {
            if (!user) return

            setIsLoadingHistory(true)
            try {
                const response = await fetch("/api/recent-documents?limit=5", {
                    credentials: "include",
                })

                if (!response.ok) {
                    console.error("[SIDEBAR] Failed to fetch recent documents")
                    setIsLoadingHistory(false)
                    return
                }

                const data = await response.json()
                // Fix: Set history state directly instead of calling the function
                setHistory(data.documents || [])
            } catch (err) {
                console.error("[SIDEBAR] Fetch error:", err)
            } finally {
                setIsLoadingHistory(false)
            }
        }

        fetchRecentDocuments()
    }, [user])

    const fetchHistory = async () => {
        try {
            setIsLoadingHistory(true)
            const response = await fetch("/api/documents?limit=10")
            if (response.ok) {
                const data = await response.json()
                setHistory(data.documents || [])
            }
        } catch (error) {
            // Error fetching history
        } finally {
            setIsLoadingHistory(false)
        }
    }

    const handleHistoryClick = async (doc: HistoryDocument) => {
        if (!onHistorySelect) return
        try {
            // Fetch full document data to match ParsedDocument interface
            const response = await fetch(`/api/parse-document?id=${doc.id}`)
            if (!response.ok) {
                throw new Error("Failed to fetch document details")
            }
            const fullData = await response.json()
            // Ensure it matches the expected shape (fallback to history data if needed)
            const formattedData = {
                id: fullData.id || doc.id,
                fileName: fullData.fileName || fullData.file_name || doc.file_name,
                fileUrl: fullData.fileUrl || fullData.file_url,
                uploadedAt: fullData.uploadedAt || fullData.created_at || doc.created_at,
                documentType: fullData.documentType || fullData.document_type || "Medical Document",
                fields: fullData.fields || [],
                summary: fullData.summary || "",
                notes: fullData.notes || [],
                structuredData: fullData.structuredData || fullData.structured_data || doc.structured_data,
                confidenceScore: fullData.confidenceScore || fullData.confidence_score,
                healthRecommendations: fullData.healthRecommendations || fullData.health_recommendations,
            }
            onHistorySelect(formattedData)
        } catch (error) {
            console.error("[LeftSidebar] Error fetching history document:", error)
            // Fallback to partial data if fetch fails
            onHistorySelect({
                id: doc.id,
                fileName: doc.file_name,
                structuredData: doc.structured_data,
                uploadedAt: doc.created_at,
                documentType: "Medical Document",
                fields: [],
                summary: "",
                notes: [],
                confidenceScore: undefined,
                healthRecommendations: undefined,
            })
        }
    }

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
        [hasReachedLimit],
    )

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (hasReachedLimit) {
            setShowLimitDialog(true)
            e.target.value = ""
            return
        }
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            const validTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"]
            const isValid = validTypes.includes(selectedFile.type)
            if (!isValid) {
                alert("Only image files (PNG, JPG, JPEG) and PDF documents are supported.")
                return
            }
            setFile(selectedFile)
        }
    }

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
        const isValid = validTypes.includes(file.type)
        if (!isValid) {
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
            // Call the wrapper API with user headers
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
            console.log("[LeftSidebar] Upload success, ID:", data.id)
            // Fetch full document data using the returned ID
            setProgressMessage("Retrieving document data...")
            const fullDataResponse = await fetch(`/api/parse-document?id=${data.id}`)
            if (!fullDataResponse.ok) {
                const errorMsg = await fullDataResponse.json().catch(() => ({ error: "Document retrieval failed" }))
                console.warn("[LeftSidebar] Document not yet available, using partial data:", errorMsg)
                // Use partial data from upload response instead of failing
                const partialData = {
                    id: data.id,
                    fileName: file.name,
                    fileUrl: undefined,
                    uploadedAt: new Date().toISOString(),
                    documentType: "Medical Document",
                    fields: [],
                    summary: "",
                    notes: [],
                    structuredData: {},
                    confidenceScore: undefined,
                    healthRecommendations: undefined,
                    jobId: data.job_id,
                    reportId: data.report_id,
                    status: "processing",
                }
                setProgressMessage("Complete!")
                setUploadProgress(100)
                await new Promise((resolve) => setTimeout(resolve, 500))
                incrementUploadCount()
                setFile(null)
                setUploadProgress(0)
                setProgressMessage("")
                fetchHistory()
                onUploadSuccess(partialData)
                return
            }
            const fullData = await fullDataResponse.json()
            console.log("[LeftSidebar] Full document data retrieved:", fullData)
            // Format the complete data
            const formattedData = {
                id: fullData.id,
                fileName: fullData.fileName || file.name,
                fileUrl: fullData.fileUrl,
                uploadedAt: fullData.uploadedAt,
                documentType: fullData.documentType || "Medical Document",
                fields: fullData.fields || [],
                summary: fullData.summary || "",
                notes: fullData.notes || [],
                structuredData: fullData.structuredData,
                confidenceScore: fullData.confidenceScore,
                healthRecommendations: fullData.healthRecommendations,
                jobId: fullData.jobId,
                reportId: fullData.reportId,
            }
            setProgressMessage("Complete!")
            setUploadProgress(100)
            await new Promise((resolve) => setTimeout(resolve, 500))
            incrementUploadCount()
            setFile(null)
            setUploadProgress(0)
            setProgressMessage("")
            fetchHistory()
            // Single callback with complete data
            onUploadSuccess(formattedData)
        } catch (error) {
            console.error("[LeftSidebar] Upload error:", error)
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
                                    hasReachedLimit ? "border-destructive/50 bg-destructive/5" : "border-border/50 bg-muted/20",
                                )}
                            >
                                <div className="flex items-center gap-2 text-xs">
                                    <AlertCircle
                                        className={cn("w-3 h-3", hasReachedLimit ? "text-destructive" : "text-muted-foreground")}
                                    />
                                    <span className={cn("font-medium", hasReachedLimit ? "text-destructive" : "text-foreground")}>
                                        {hasReachedLimit ? "Upload limit reached (10/10)" : `${user?.uploadCount || 0}/10 uploads used`}
                                    </span>
                                </div>
                            </Card>
                        )}
                        {/* Upload Area */}
                        <Card className="border border-primary/20 shadow-lg bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
                            <div className="p-2 space-y-2">
                                {/* Header */}
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                                        <Upload className="w-3 h-3 text-primary" />
                                    </div>
                                    <h3 className="text-xs font-semibold text-foreground">
                                        Upload New Document
                                    </h3>
                                </div>
                                {/* Drop Zone */}
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={cn(
                                        "relative border-2 border-dashed rounded-lg p-3 text-center transition-all",
                                        isDragging
                                            ? "border-primary bg-primary/10 scale-[1.01]"
                                            : "border-border/50 bg-muted/30 hover:border-primary/50 hover:bg-muted/50",
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
                                                        {(file.size / 1024 / 1024).toFixed(2)} MB
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
                                                document.getElementById("file-upload")?.click()
                                            }
                                        >
                                            {file ? "Change File" : "Browse Files"}
                                        </Button>
                                    </div>
                                </div>
                                {/* Upload Progress */}
                                {/* Action Button */}
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
                            {isLoadingHistory ? (
                                <Card className="border border-border/50">
                                    <div className="p-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Loading history...
                                    </div>
                                </Card>
                            ) : history.length > 0 ? (
                                <div className="space-y-1">
                                    {history.map((doc) => (
                                        <Card
                                            key={doc.id}
                                            className="border border-border/50 hover:border-primary/50 hover:bg-accent/5 transition-all py-2 cursor-pointer group min-h-[40px]"
                                            onClick={() => handleHistoryClick(doc)}
                                        >
                                            <div className="p-2 flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                                                    <FileText className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-foreground truncate max-w-[180px]">
                                                        {doc.file_name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatDate(doc.created_at)}
                                                    </p>
                                                </div>
                                                <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <Card className="border border-border/50 bg-muted/20">
                                    <div className="p-3 text-center text-xs text-muted-foreground">
                                        No recent documents
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
                                You have reached your upload limit of 10 documents.
                            </p>
                            <p className="text-xs text-foreground">
                                To upload more documents, please contact our sales team at <a href="mailto:sales@yira.ai" className="text-primary hover:underline">sales@yira.ai</a> or upgrade your plan.
                            </p>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end">
                        <Button onClick={() => setShowLimitDialog(false)}>Close</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}