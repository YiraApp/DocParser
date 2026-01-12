"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    LogOut,
    Shield,
    Loader2,
    AlertCircle,
    Search,
    X,
    Clock,
    Mail,
    FileText,
    User,
    BarChart3,
} from "lucide-react"
import Image from "next/image"
import { Label } from "@/components/ui/label"

interface Document {
    id: string
    file_name: string
    created_at: string
    user_email: string
    user_name?: string
    document_type: string
    status: string
    structured_data?: any
}

export default function AdminPage() {
    const router = useRouter()
    const { user, logout, isAdmin, isLoading } = useAuth()
    const [allDocuments, setAllDocuments] = useState<Document[]>([])
    const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([])
    const [isLoadingDocs, setIsLoadingDocs] = useState(false)
    const [error, setError] = useState("")
    const [searchQuery, setSearchQuery] = useState("")
    const [filterType, setFilterType] = useState<"email" | "name">("email")

    // Redirect if not admin
    useEffect(() => {
        if (isLoading) return
        if (!user || !isAdmin) {
            router.push("/")
        }
    }, [user, isAdmin, router, isLoading])

    // Fetch all documents on mount
    useEffect(() => {
        const fetchAllDocuments = async () => {
            if (!isAdmin) return

            setIsLoadingDocs(true)
            setError("")
            try {
                // Fetch max 100 documents for admin
                const response = await fetch("/api/recent-documents?limit=100", {
                    credentials: "include",
                })

                if (!response.ok) {
                    throw new Error("Failed to fetch documents")
                }

                const data = await response.json()
                setAllDocuments(data.documents || [])
                setFilteredDocuments(data.documents || [])
            } catch (err) {
                console.error("[ADMIN] Fetch error:", err)
                setError("Failed to load documents. Please refresh the page.")
                setAllDocuments([])
            } finally {
                setIsLoadingDocs(false)
            }
        }

        fetchAllDocuments()
    }, [isAdmin])

    // Real-time filtering
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredDocuments(allDocuments)
            return
        }

        const query = searchQuery.toLowerCase().trim()
        const filtered = allDocuments.filter((doc) => {
            if (filterType === "email") {
                return doc.user_email?.toLowerCase().includes(query)
            } else {
                return doc.user_name?.toLowerCase().includes(query)
            }
        })

        // Limit to 5 results when searching
        setFilteredDocuments(filtered.slice(0, 5))
    }, [searchQuery, allDocuments, filterType])

    const handleLogout = async () => {
        await logout()
    }

    const handleDocumentClick = (docId: string) => {
        // Navigate to document details
        router.push(`/?id=${docId}`)
    }

    const handleClearSearch = () => {
        setSearchQuery("")
    }

    const handleFilterTypeChange = (type: "email" | "name") => {
        setFilterType(type)
        setSearchQuery("") // Clear search when changing filter type
    }

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <div className="text-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        )
    }

    if (!isAdmin) {
        return null
    }

    return (
        <div className="min-h-screen bg-background">
            {/* HEADER */}
            <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
                <div className="px-4 sm:px-6 py-3">
                    <div className="flex items-center justify-between gap-4">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <Image src="/yiralogo.png" alt="Yira Logo" width={40} height={40} />
                            <div>
                                <h1 className="text-lg font-semibold">Yira MedSense</h1>
                                <p className="text-xs text-muted-foreground hidden sm:block">
                                    Admin Dashboard
                                </p>
                            </div>
                        </div>
                        {/* Right Actions */}
                        <div className="flex items-center gap-2">
                            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
                                <Shield className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium">{user?.email}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleLogout}
                                className="gap-2"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="hidden sm:inline">Logout</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="p-4 sm:p-6">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Header Section */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-6 h-6 text-primary" />
                            <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
                        </div>
                        <p className="text-muted-foreground">
                            View and manage all uploaded documents from users
                        </p>
                    </div>

                    {/* Filter Section */}
                    <Card className="border border-border/50 p-4 sm:p-6 space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Search className="w-4 h-4 text-muted-foreground" />
                                <Label className="text-sm font-semibold">Search Documents</Label>
                            </div>

                            {/* Filter Type Buttons */}
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => handleFilterTypeChange("email")}
                                    className={`py-2 px-4 rounded-lg border text-sm font-medium transition flex items-center justify-center gap-2 ${
                                        filterType === "email"
                                            ? "bg-blue-50 border-blue-300 text-blue-700"
                                            : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                                    }`}
                                >
                                    <Mail className="w-4 h-4" />
                                    By Email
                                </button>
                                <button
                                    onClick={() => handleFilterTypeChange("name")}
                                    className={`py-2 px-4 rounded-lg border text-sm font-medium transition flex items-center justify-center gap-2 ${
                                        filterType === "name"
                                            ? "bg-blue-50 border-blue-300 text-blue-700"
                                            : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                                    }`}
                                >
                                    <User className="w-4 h-4" />
                                    By Name
                                </button>
                            </div>

                            {/* Search Input */}
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input
                                    type="text"
                                    placeholder={
                                        filterType === "email"
                                            ? "Search by email (e.g., user@example.com)"
                                            : "Search by name (e.g., John Doe)"
                                    }
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 h-10 border-slate-200"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={handleClearSearch}
                                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Search Info */}
                            {searchQuery && (
                                <div className="text-xs text-muted-foreground flex items-center justify-between">
                                    <span>
                                        Showing {filteredDocuments.length} of {allDocuments.length} documents
                                    </span>
                                    {filteredDocuments.length === 5 && allDocuments.length > 5 && (
                                        <span className="text-xs text-amber-600">Limited to 5 results</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    {/* Documents Grid */}
                    <div className="space-y-3">
                        {isLoadingDocs ? (
                            <Card className="border border-border/50 p-8">
                                <div className="flex justify-center items-center">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                            </Card>
                        ) : filteredDocuments.length > 0 ? (
                            <>
                                <div className="text-sm font-semibold text-muted-foreground">
                                    {searchQuery
                                        ? `${filteredDocuments.length} document${
                                              filteredDocuments.length !== 1 ? "s" : ""
                                          } found`
                                        : `Showing latest ${filteredDocuments.length} document${
                                              filteredDocuments.length !== 1 ? "s" : ""
                                          }`}
                                </div>
                                {filteredDocuments.map((doc) => (
                                    <Card
                                        key={doc.id}
                                        className="border border-border/50 hover:border-primary/50 transition cursor-pointer p-4"
                                        onClick={() => handleDocumentClick(doc.id)}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                            {/* Document Info */}
                                            <div className="flex-1 space-y-2 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                                    <h3 className="text-sm font-semibold text-foreground truncate">
                                                        {doc.file_name}
                                                    </h3>
                                                    <Badge variant="outline" className="text-xs">
                                                        {doc.document_type || "Medical Document"}
                                                    </Badge>
                                                </div>

                                                {/* User Info */}
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                                    <div className="flex items-center gap-1">
                                                        <Mail className="w-3 h-3" />
                                                        {doc.user_email}
                                                    </div>
                                                    {doc.user_name && (
                                                        <div className="flex items-center gap-1">
                                                            <User className="w-3 h-3" />
                                                            {doc.user_name}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(doc.created_at).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status Badge */}
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={
                                                        doc.status === "completed"
                                                            ? "default"
                                                            : doc.status === "processing"
                                                              ? "secondary"
                                                              : "destructive"
                                                    }
                                                    className="text-xs"
                                                >
                                                    {doc.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </>
                        ) : (
                            <Card className="border border-border/50 p-8">
                                <div className="text-center space-y-3">
                                    <FileText className="w-12 h-12 text-muted-foreground mx-auto opacity-50" />
                                    <p className="text-muted-foreground">
                                        {searchQuery
                                            ? `No documents found for "${searchQuery}"`
                                            : "No documents available"}
                                    </p>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}