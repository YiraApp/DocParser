"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
    Search,
    FileText,
    Calendar,
    Loader2,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    X,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface Document {
    id: string
    user_name: string
    file_name: string
    document_type: string
    created_at: string
    structured_data?: Record<string, any>
}

interface HomeSearchPanelProps {
    onDocumentSelect: (document: any) => void
    onClose: () => void
}

function transformDocument(doc: Document): any {
    const fields: any[] = []

    const flatten = (obj: any, prefix = "") => {
        Object.entries(obj || {}).forEach(([k, v]: any) => {
            const key = prefix ? `${prefix} > ${k}` : k
            if (v && typeof v === "object" && !Array.isArray(v)) {
                flatten(v, key)
            } else if (v !== null && v !== undefined) {
                fields.push({
                    label: key.replace(/([A-Z])/g, " $1").trim(),
                    value: Array.isArray(v) ? v.map((item: any) => 
                        typeof item === "object" ? JSON.stringify(item) : String(item)
                    ).join(", ") : String(v),
                })
            }
        })
    }

    flatten(doc.structured_data)

    const healthRecommendations = doc.structured_data?.healthRecommendations || 
                                 doc.structured_data?.recommendations || 
                                 null

    return {
        id: doc.id,
        fileName: doc.file_name,
        uploadedAt: doc.created_at,
        documentType: doc.document_type,
        fields,
        summary: doc.structured_data?.summary || doc.structured_data?.documentSummary || "",
        notes: doc.structured_data?.notes || [],
        structuredData: doc.structured_data || {},
        confidenceScore: doc.structured_data?.metadata?.confidenceScore || 
                        doc.structured_data?.confidence || 85,
        healthRecommendations: healthRecommendations,
    }
}

export function HomeSearchPanel({ onDocumentSelect, onClose }: HomeSearchPanelProps) {
    const [query, setQuery] = useState("")
    const [docs, setDocs] = useState<Document[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [expanded, setExpanded] = useState<Set<string>>(new Set())

    const searchDocs = useCallback(async (q: string) => {
        if (!q.trim()) {
            setDocs([])
            setSearched(false)
            setError(null)
            return
        }

        setLoading(true)
        setSearched(true)
        setError(null)

        try {
            const res = await fetch(`/api/search-documents?query=${encodeURIComponent(q)}`)
            if (!res.ok) {
                throw new Error("Search failed")
            }
            const data = await res.json()
            setDocs(data.documents || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : "Search failed")
            setDocs([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        const t = setTimeout(() => searchDocs(query), 300)
        return () => clearTimeout(t)
    }, [query, searchDocs])

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })

    const toggleExpanded = (docId: string) => {
        setExpanded((prev) => {
            const newSet = new Set(prev)
            if (newSet.has(docId)) {
                newSet.delete(docId)
            } else {
                newSet.add(docId)
            }
            return newSet
        })
    }

    return (
        <div className="flex flex-col h-[calc(100vh-64px)]">
            <div className="flex items-center justify-between px-3 h-12 border-b">
                <h3 className="text-sm font-semibold">Search Documents</h3>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="w-4 h-4" />
                </Button>
            </div>

            <div className="px-3 py-2 border-b">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search documents..."
                        className="pl-8 h-9 text-sm"
                        autoFocus
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="w-4 h-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {loading && (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                )}

                {!loading && searched && docs.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">
                        No results found
                    </p>
                )}

                {!loading &&
                    docs.map((doc) => {
                        const open = expanded.has(doc.id)

                        return (
                            <Card
                                key={doc.id}
                                className="p-2 hover:bg-muted/40 transition cursor-pointer"
                            >
                                <div className="flex gap-2">
                                    <FileText className="w-4 h-4 mt-1 text-muted-foreground" />

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                            <button
                                                className="text-left truncate text-sm font-medium hover:text-primary"
                                                onClick={() => {
                                                    const t = transformDocument(doc)
                                                    onDocumentSelect(t)
                                                }}
                                            >
                                                {doc.file_name}
                                            </button>

                                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(doc.created_at)}
                                            </span>
                                        </div>

                                        <div className="flex gap-2 mt-1 text-[11px]">
                                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                                                {doc.document_type}
                                            </span>
                                            <span className="text-muted-foreground truncate">
                                                {doc.user_name}
                                            </span>
                                        </div>

                                        {doc.structured_data && (
                                            <button
                                                className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                                                onClick={() => toggleExpanded(doc.id)}
                                            >
                                                {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                {open ? "Hide details" : "Show details"}
                                            </button>
                                        )}

                                        {open && (
                                            <div className="mt-1 bg-muted/30 rounded p-2 text-[11px] space-y-1">
                                                {Object.entries(doc.structured_data || {})
                                                    .slice(0, 6)
                                                    .map(([k, v]) => {
                                                        let displayValue = ""
                                                        if (Array.isArray(v)) {
                                                            displayValue = v.map((item: any) =>
                                                                typeof item === "object" ? JSON.stringify(item) : String(item)
                                                            ).join(", ")
                                                        } else if (typeof v === "object" && v !== null) {
                                                            displayValue = JSON.stringify(v, null, 2)
                                                        } else {
                                                            displayValue = String(v)
                                                        }
                                                        return (
                                                            <div key={k}>
                                                                <span className="font-medium">{k}:</span>{" "}
                                                                <span className="whitespace-pre-wrap break-words">{displayValue}</span>
                                                            </div>
                                                        )
                                                    })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        )
                    })}
            </div>
        </div>
    )
}
