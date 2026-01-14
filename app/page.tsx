// Modified HomePage component
"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ResultsSection } from "@/components/results-section"
import { HomeSearchPanel } from "@/components/home-search-panel"
import { LeftSidebar } from "@/components/left-sidebar"
import { Button } from "@/components/ui/button"
import { Search, LogOut, User, Shield, UserPlus, X, AlertCircle, CheckCircle, Loader2, BarChart3, Eye, EyeOff } from "lucide-react"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { SearchInterface } from "../components/search-interface"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
interface ProcessingState {
    isProcessing: boolean
    fileName: string
    documentId: string
    jobId: string
}
export default function HomePage() {
    const [parsedDocument, setParsedDocument] = useState<any>(null)
    const [showResults, setShowResults] = useState(false)
    const [showSearch, setShowSearch] = useState(false)
    const [showCreateAccount, setShowCreateAccount] = useState(false)
    const [createEmail, setCreateEmail] = useState("")
    const [createPassword, setCreatePassword] = useState("")
    const [createConfirmPassword, setCreateConfirmPassword] = useState("")
    const [createRole, setCreateRole] = useState<"admin" | "user">("user")
    const [createError, setCreateError] = useState("")
    const [createSuccess, setCreateSuccess] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [createName, setCreateName] = useState("")
    const [createPhoneNumber, setCreatePhoneNumber] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [processingState, setProcessingState] = useState<ProcessingState>({
        isProcessing: false,
        fileName: "",
        documentId: "",
        jobId: "",
    })
    const [isLoadingDocument, setIsLoadingDocument] = useState(false)
    const [selectedDocumentId, setSelectedDocumentId] = useState<string | undefined>(undefined)
    const { user, logout, isAdmin, isLoading } = useAuth()
    const router = useRouter()
    useEffect(() => {
        if (isLoading) return
        if (!user) {
            router.push("/login")
        }
    }, [user, router, isLoading])
    // Poll for document completion when processing
    useEffect(() => {
        if (!processingState.isProcessing || !processingState.documentId) return
        let pollAttempts = 0
        const maxAttempts = 240 // 4 minutes with 1-second intervals
        const pollInterval = setInterval(async () => {
            pollAttempts++
            console.log(`[PAGE] Polling for document... (attempt ${pollAttempts}/${maxAttempts})`)
            try {
                const response = await fetch(`/api/parse-document?id=${processingState.documentId}`)
                if (response.ok) {
                    const fullData = await response.json()
                    // Check if document has structured data (webhook has processed it)
                    if (fullData && fullData.structuredData && Object.keys(fullData.structuredData).length > 0) {
                        console.log("[PAGE] Document ready! Loading results...")
                        const formattedData = {
                            id: fullData.id || processingState.documentId,
                            fileName: fullData.fileName || processingState.fileName,
                            fileUrl: fullData.fileUrl,
                            uploadedAt: fullData.uploadedAt || new Date().toISOString(),
                            documentType: fullData.documentType || "Medical Document",
                            fields: fullData.fields || [],
                            summary: fullData.summary || "",
                            notes: fullData.notes || [],
                            structuredData: fullData.structuredData || {},
                            confidenceScore: fullData.confidenceScore,
                            healthRecommendations: fullData.healthRecommendations,
                            jobId: processingState.jobId,
                        }
                        // Update parsed document and show results view
                        setParsedDocument(formattedData)
                        setShowResults(true)
                        // Clear processing state
                        setProcessingState({
                            isProcessing: false,
                            fileName: "",
                            documentId: "",
                            jobId: "",
                        })
                        clearInterval(pollInterval)
                        return
                    }
                }
            } catch (err) {
                console.error("[PAGE] Polling error:", err)
            }
            // Stop polling after max attempts
            if (pollAttempts >= maxAttempts) {
                console.warn("[PAGE] Max polling attempts reached")
                setProcessingState({
                    isProcessing: false,
                    fileName: "",
                    documentId: "",
                    jobId: "",
                })
                clearInterval(pollInterval)
            }
        }, 1000)
        return () => clearInterval(pollInterval)
    }, [processingState.isProcessing, processingState.documentId])
    if (isLoading || !user) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <div className="text-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        )
    }
    const handleUploadSuccess = (document: any) => {
        // If document is still processing, track it in sidebar
        if (document.status === "processing") {
            setProcessingState({
                isProcessing: true,
                fileName: document.fileName,
                documentId: document.id,
                jobId: document.jobId,
            })
        } else {
            // Otherwise show results immediately
            setParsedDocument(document)
            setShowResults(true)
            setShowSearch(false)
        }
    }
    const handleHistoryClickStart = (docId: string) => {
        setSelectedDocumentId(docId)
        setIsLoadingDocument(true)
        setShowResults(true)
        setShowSearch(false)
        setParsedDocument(null) // Clear previous data
    }
    const handleHistorySelect = (document: any) => {
        setParsedDocument(document)
        setIsLoadingDocument(false)
    }
    const handleSearchDocumentSelect = (document: any) => {
        const transformedDocument = {
            id: document.id,
            fileName: document.file_name || document.fileName,
            fileUrl: document.file_url || document.fileUrl,
            uploadedAt: document.created_at || document.uploadedAt || new Date().toISOString(),
            documentType: document.document_type || document.documentType || "Medical Document",
            fields: document.parsed_fields || document.fields || [],
            summary: document.summary || "",
            notes: document.notes || [],
            structuredData: document.structured_data || document.structuredData || {},
            confidenceScore: document.confidence_score || document.confidenceScore || 0,
            healthRecommendations: document.health_recommendations || document.healthRecommendations || null,
        }
        setParsedDocument(transformedDocument)
        setShowResults(true)
        setShowSearch(false)
    }
    const handleNewUpload = () => {
        setParsedDocument(null)
        setShowResults(false)
        setSelectedDocumentId(undefined)
        setProcessingState({
            isProcessing: false,
            fileName: "",
            documentId: "",
            jobId: "",
        })
    }
    const handleCloseResults = () => {
        setParsedDocument(null)
        setShowResults(false)
        setSelectedDocumentId(undefined)
        setProcessingState({
            isProcessing: false,
            fileName: "",
            documentId: "",
            jobId: "",
        })
    }
    const handleSearchToggle = () => {
        setShowSearch(prev => !prev)
    }
    const handleLogout = () => {
        logout()
    }
    const handleCreateAccountClick = () => {
        setShowCreateAccount(true)
        setCreateEmail("")
        setCreatePassword("")
        setCreateConfirmPassword("")
        setCreateName("")
        setCreatePhoneNumber("")
        setCreateRole("user")
        setCreateError("")
        setCreateSuccess(false)
        setShowPassword(false)
        setShowConfirmPassword(false)
    }
    const handleCreateAccountSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreateError("")
        setCreateSuccess(false)
        if (!createEmail || !createPassword || !createConfirmPassword || !createName || !createPhoneNumber) {
            setCreateError("All fields are required")
            return
        }
        if (!createPhoneNumber.replace(/\D/g, "").match(/^\d{10}$/)) {
            setCreateError("Phone number must be exactly 10 digits")
            return
        }
        if (createPassword !== createConfirmPassword) {
            setCreateError("Passwords do not match")
            return
        }
        if (createPassword.length < 6) {
            setCreateError("Password must be at least 6 characters")
            return
        }
        if (createRole === "admin" && !isAdmin) {
            setCreateError("Only admins can create admin accounts")
            return
        }
        setIsCreating(true)
        try {
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: createEmail,
                    password: createPassword,
                    name: createName,
                    phoneNumber: createPhoneNumber,
                    role: createRole,
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                setCreateError(data.error || "Failed to create account")
                return
            }
            setCreateSuccess(true)
            setCreateEmail("")
            setCreatePassword("")
            setCreateConfirmPassword("")
            setCreateName("")
            setCreatePhoneNumber("")
            setCreateRole("user")
            setShowPassword(false)
            setShowConfirmPassword(false)
            setTimeout(() => {
                setShowCreateAccount(false)
            }, 2000)
        } catch (err) {
            setCreateError("An error occurred while creating account")
        } finally {
            setIsCreating(false)
        }
    }
    return (
        <div className="h-screen flex flex-col overflow-hidden bg-background">
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
                                    AI-powered health data analysis
                                </p>
                            </div>
                        </div>
                        {/* Right Actions */}
                        <div className="flex items-center gap-2">
                            {/* User Info */}
                            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
                                {isAdmin ? (
                                    <Shield className="w-4 h-4 text-primary" />
                                ) : (
                                    <User className="w-4 h-4 text-muted-foreground" />
                                )}
                                <span className="text-sm font-medium">{user.email}</span>
                                {!isAdmin && (
                                    <Badge variant="secondary" className="text-xs">
                                        {user?.uploadCount || 0}/10
                                    </Badge>
                                )}
                            </div>
                            {/* SEARCH BUTTON + DROPDOWN */}
                            <div className="relative">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleSearchToggle}
                                    className="gap-2"
                                >
                                    <Search className="w-4 h-4" />
                                    <span className="hidden sm:inline">Search</span>
                                </Button>
                                {showSearch && (
                                    <div className="absolute right-0 top-full mt-2 w-[500px] max-h-[600px] z-50 rounded-xl border bg-background shadow-xl overflow-hidden flex flex-col">
                                        <SearchInterface
                                            onDocumentSelect={handleSearchDocumentSelect}
                                            onClose={() => setShowSearch(false)}
                                        />
                                    </div>
                                )}
                            </div>
                            {/* CREATE ACCOUNT BUTTON */}
                            {isAdmin && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCreateAccountClick}
                                    className="gap-2"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    <span className="hidden sm:inline">Create Account</span>
                                </Button>
                            )}
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
            {/* BODY */}
            <div className="flex flex-1 overflow-hidden">
                <LeftSidebar
                    onUploadSuccess={handleUploadSuccess}
                    onHistorySelect={handleHistorySelect}
                    onHistoryClickStart={handleHistoryClickStart} // Pass new prop
                    processingDocumentId={processingState.documentId}
                    selectedDocumentId={selectedDocumentId}
                />
                <main className="flex-1 overflow-y-auto">
                    {isLoadingDocument ? (
                        <div className="flex items-center justify-center min-h-full p-6">
                            <div className="text-center space-y-4">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                                <p className="text-muted-foreground">Loading document...</p>
                            </div>
                        </div>
                    ) : showResults ? (
                        <div className="p-4 sm:p-6">
                            <ResultsSection
                                document={parsedDocument}
                                onNewUpload={handleNewUpload}
                                onClose={handleCloseResults}
                            />
                        </div>
                    ) : (
                        <div className="flex items-center justify-center min-h-full p-6">
                            <div className="text-center space-y-4 max-w-2xl">
                                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                                    <Image src="/yiralogo.png" alt="Yira" width={48} height={48} />
                                </div>
                                <h2 className="text-3xl font-bold">Welcome to Yira MedSense</h2>
                                <p className="text-lg text-muted-foreground">
                                    Upload a medical document from the left sidebar or use search to find existing documents
                                </p>
                                {!isAdmin && user && (
                                    <p className="text-sm text-muted-foreground">
                                        You have <span className="font-semibold text-foreground">{Math.max(0, 10 - (user.uploadCount || 0))}</span> uploads remaining
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>
            {/* CREATE ACCOUNT MODAL */}
            {showCreateAccount && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[80vh] overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 scrollbar-thumb-rounded-full scrollbar-track-rounded-full">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold">Create New Account</h2>
                            <button
                                onClick={() => setShowCreateAccount(false)}
                                className="p-1 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {/* Form */}
                        <form onSubmit={handleCreateAccountSubmit} className="space-y-4">
                            {/* Role Selection */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Account Type</Label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCreateRole("user")}
                                        className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition flex items-center justify-center gap-2 ${createRole === "user"
                                            ? "bg-blue-50 border-blue-300 text-blue-700"
                                            : "border-gray-300 text-gray-600 hover:border-gray-400"
                                            }`}
                                    >
                                        <User className="w-4 h-4" />
                                        User
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (isAdmin) {
                                                setCreateRole("admin")
                                            } else {
                                                setCreateError("Only admins can create admin accounts")
                                            }
                                        }}
                                        disabled={!isAdmin}
                                        className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition flex items-center justify-center gap-2 ${createRole === "admin"
                                            ? "bg-blue-50 border-blue-300 text-blue-700"
                                            : isAdmin
                                                ? "border-gray-300 text-gray-600 hover:border-gray-400"
                                                : "border-gray-200 text-gray-400 cursor-not-allowed"
                                            }`}
                                    >
                                        <Shield className="w-4 h-4" />
                                        Admin
                                    </button>
                                </div>
                                {!isAdmin && <p className="text-xs text-gray-500">Only admins can create admin accounts</p>}
                            </div>
                            {/* Email */}
                            <div className="space-y-2">
                                <Label htmlFor="create-email" className="text-sm font-medium">Email</Label>
                                <Input
                                    id="create-email"
                                    type="email"
                                    placeholder="Enter email"
                                    value={createEmail}
                                    onChange={(e) => setCreateEmail(e.target.value)}
                                    required
                                />
                            </div>
                            {/* Password */}
                            <div className="space-y-2">
                                <Label htmlFor="create-password" className="text-sm font-medium">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="create-password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter password"
                                        value={createPassword}
                                        onChange={(e) => setCreatePassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            {/* Confirm Password */}
                            <div className="space-y-2">
                                <Label htmlFor="create-confirm-password" className="text-sm font-medium">Confirm Password</Label>
                                <div className="relative">
                                    <Input
                                        id="create-confirm-password"
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="Confirm password"
                                        value={createConfirmPassword}
                                        onChange={(e) => setCreateConfirmPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            {/* Full Name Field */}
                            <div className="space-y-2">
                                <Label htmlFor="create-name" className="text-sm font-medium">Full Name</Label>
                                <Input
                                    id="create-name"
                                    type="text"
                                    placeholder="Enter full name"
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    required
                                />
                            </div>
                            {/* Phone Number Field */}
                            <div className="space-y-2">
                                <Label htmlFor="create-phone" className="text-sm font-medium">Phone Number (10 digits)</Label>
                                <Input
                                    id="create-phone"
                                    type="tel"
                                    placeholder="10-digit number"
                                    value={createPhoneNumber}
                                    onChange={(e) => setCreatePhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                    required
                                    maxLength={10}
                                />
                                <p className="text-xs text-gray-500">Enter 10 digits without spaces</p>
                            </div>
                            {/* Error Message */}
                            {createError && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {createError}
                                </div>
                            )}
                            {/* Success Message */}
                            {createSuccess && (
                                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                                    <CheckCircle className="w-4 h-4 shrink-0" />
                                    Account created successfully!
                                </div>
                            )}
                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowCreateAccount(false)}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isCreating}
                                    className="flex-1"
                                >
                                    {isCreating ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        "Create Account"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}