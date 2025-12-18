"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ResultsSection } from "@/components/results-section"
import { HomeSearchPanel } from "@/components/home-search-panel"
import { LeftSidebar } from "@/components/left-sidebar"
import { Button } from "@/components/ui/button"
import { Search, LogOut, User, Shield } from "lucide-react"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { SearchInterface } from "../components/search-interface"

export default function HomePage() {
    const [parsedDocument, setParsedDocument] = useState<any>(null)
    const [showResults, setShowResults] = useState(false)
    const [showSearch, setShowSearch] = useState(false)
    const [isHydrated, setIsHydrated] = useState(false)

    const { user, logout, isAdmin } = useAuth()
    const router = useRouter()

    useEffect(() => {
        setIsHydrated(true)
    }, [])

    useEffect(() => {
        if (!isHydrated) return
        
        if (!user) {
            router.push("/login")
        }
    }, [user, router, isHydrated])

    if (!isHydrated || !user) return null

    const handleUploadSuccess = (document: any) => {
        setParsedDocument(document)
        setShowResults(true)
        setShowSearch(false)
    }

    const handleHistorySelect = (document: any) => {
        setParsedDocument(document)
        setShowResults(true)
        setShowSearch(false)
    }

    const handleSearchDocumentSelect = (document: any) => {
        // Transform the search result document to match ResultsView expectations
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
    }

    const handleCloseResults = () => {
        setParsedDocument(null)
        setShowResults(false)
    }

    const handleSearchToggle = () => {
        setShowSearch(prev => !prev)
    }

    const handleLogout = () => {
        logout()
        router.push("/login")
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
                                        {user?.uploadCount || 0}/5
                                    </Badge>
                                )}
                            </div>

                            {/* 🔍 SEARCH BUTTON + DROPDOWN */}
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

                            <Link href="/metrics" />

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
                />

                <main className="flex-1 overflow-y-auto">
                    {showResults ? (
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
                                        You have <span className="font-semibold text-foreground">{Math.max(0, 5 - (user.uploadCount || 0))}</span> uploads remaining
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
