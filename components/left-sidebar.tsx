// Modified LeftSidebar component
"use client"
import type React from "react"
import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, FileText, Loader2, CheckCircle2, Zap, Clock, ChevronRight, AlertCircle, Search, X, ChevronLeft } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/lib/auth-context"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
interface LeftSidebarProps {
    onUploadSuccess: (document: any) => void
    onHistorySelect?: (document: any) => void
    onHistoryClickStart?: (docId: string) => void // New prop for starting history click
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
}
interface PaginationInfo {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
}
export function LeftSidebar({ onUploadSuccess, onHistorySelect, onHistoryClickStart, processingDocumentId, selectedDocumentId }: LeftSidebarProps) {
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
    const { user, incrementUploadCount, isAdmin } = useAuth()
    const hasReachedLimit = !(isAdmin ?? false) && (user?.uploadCount ?? 0) >= 10
    // Fetch documents with pagination
    const fetchDocuments = async (page: number = 1) => {
        if (!user) return
        setIsLoadingHistory(true)
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "5",
            })
            // Only add filters for admins
            if (isAdmin) {
                if (filterQuery.trim()) {
                    if (filterType === "email") {
                        params.append("filterEmail", filterQuery)
                    } else if (filterType === "user") {
                        params.append("filterUser", filterQuery)
                    } else {
                        params.append("filterName", filterQuery)
                    }
                }
            }
            const response = await fetch(`/api/recent-documents?${params}`, {
                credentials: "include",
            })
            if (!response.ok) {
                console.error("[SIDEBAR] Failed to fetch documents")
                setIsLoadingHistory(false)
                return
            }
            const data = await response.json()
            setHistory(data.documents || [])
            setPagination(data.pagination)
            setCurrentPage(page)
        } catch (err) {
            console.error("[SIDEBAR] Fetch error:", err)
        } finally {
            setIsLoadingHistory(false)
        }
    }
    // Fetch on component mount
    useEffect(() => {
        fetchDocuments(1)
    }, [user])
    // Fetch when filter changes (for admins only)
    useEffect(() => {
        if (isAdmin) {
            fetchDocuments(1)
        }
    }, [filterQuery, filterType, isAdmin])
    const handleHistoryClick = async (doc: HistoryDocument) => {
        onHistoryClickStart?.(doc.id) // Call start callback before fetch
        if (!onHistorySelect) return
        try {
            const response = await fetch(`/api/parse-document?id=${doc.id}`)
            if (!response.ok) {
                throw new Error("Failed to fetch document details")
            }
            const fullData = await response.json()
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
                jobId: fullData.jobId || doc.job_id,
            }
            onHistorySelect(formattedData)
        } catch (error) {
            console.error("[LeftSidebar] Error fetching history document:", error)
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
                jobId: doc.job_id,
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
            setProgressMessage("Complete!")
            setUploadProgress(100)
            await new Promise((resolve) => setTimeout(resolve, 500))
            // Create processing document object to show spinner on main page
            const processingDocument = {
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
            incrementUploadCount()
            setFile(null)
            setUploadProgress(0)
            setProgressMessage("")
            fetchDocuments(1)
            // Pass processing document to parent - will show spinner
            onUploadSuccess(processingDocument)
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
                            {/* Filter Section - For Admins (show always when admin, not just when history exists) */}
                            {isAdmin && (
                                <Card className="border border-border/50 bg-muted/20 p-2">
                                    <div className="space-y-2">
                                        <Tabs defaultValue="name" value={filterType} onValueChange={(value) => setFilterType(value as "name" | "email" | "user")}>
                                            <TabsList className="grid w-full grid-cols-3 h-7">
                                                <TabsTrigger value="name" className="text-xs">File Name</TabsTrigger>
                                                <TabsTrigger value="user" className="text-xs">User Name</TabsTrigger>
                                                <TabsTrigger value="email" className="text-xs">Email</TabsTrigger>
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
                                                onChange={(e) => setFilterQuery(e.target.value)}
                                                className="pl-7 h-7 text-xs"
                                            />
                                            {filterQuery && (
                                                <button
                                                    onClick={() => setFilterQuery("")}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                        {pagination && (
                                            <div className="text-[10px] text-muted-foreground space-y-1">
                                                <div>
                                                    Found: <span className="font-semibold">{pagination.total}</span> total documents
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
                                    {history.map((doc) => (
                                        <Card
                                            key={doc.id}
                                            className={cn(
                                                "border hover:border-primary/50 hover:bg-accent/5 transition-all py-2 cursor-pointer group min-h-[40px]",
                                                selectedDocumentId === doc.id ? "border-primary bg-primary/5" : "border-border/50"
                                            )}
                                            onClick={() => handleHistoryClick(doc)}
                                        >
                                            <div className="p-2 flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                                                    {processingDocumentId === doc.id ? (
                                                        <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />
                                                    ) : (
                                                        <FileText className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-foreground truncate max-w-[180px]">
                                                        {doc.file_name}
                                                    </p>
                                                    {isAdmin && doc.user_name && (
                                                        <p className="text-[10px] text-muted-foreground truncate">
                                                            {doc.user_name}
                                                        </p>
                                                    )}
                                                    {isAdmin && doc.user_email && (
                                                        <p className="text-[10px] text-muted-foreground truncate">
                                                            {doc.user_email}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-1">
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {formatDate(doc.created_at)}
                                                        </p>
                                                        {processingDocumentId === doc.id && (
                                                            <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 border-0">
                                                                In Progress
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            ) : null}
                            {/* Pagination Controls */}
                            {pagination && pagination.totalPages > 1 && history.length > 0 && (
                                <Card className="border border-border/50 bg-muted/20 p-2">
                                    <div className="flex items-center justify-between gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2"
                                            disabled={!pagination.hasPrevPage}
                                            onClick={() => fetchDocuments(currentPage - 1)}
                                        >
                                            <ChevronLeft className="w-3 h-3" />
                                        </Button>
                                        <div className="text-[10px] text-muted-foreground whitespace-nowrap flex-1 text-center">
                                            Page <span className="font-semibold">{pagination.page}</span> of <span className="font-semibold">{pagination.totalPages}</span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2"
                                            disabled={!pagination.hasNextPage}
                                            onClick={() => fetchDocuments(currentPage + 1)}
                                        >
                                            <ChevronRight className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </Card>
                            )}
                            {/* Empty State Messages */}
                            {!isLoadingHistory && history.length === 0 && (
                                <Card className="border border-border/50 bg-muted/20">
                                    <div className="p-3 text-center text-xs text-muted-foreground">
                                        {isAdmin && filterQuery ? "No documents match your filter" : "No recent documents"}
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