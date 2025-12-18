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

interface SearchInterfaceProps {
    onDocumentSelect?: (document: Document) => void
    onClose?: () => void
}

export function SearchInterface({
    onDocumentSelect, onClose,
}: SearchInterfaceProps = {}) {
    const [searchQuery, setSearchQuery] = useState("")
    const [documents, setDocuments] = useState<Document[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())

    const performSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setDocuments([])
            setHasSearched(false)
            setError(null)
            return
        }

        setIsSearching(true)
        setHasSearched(true)

        try {
            const response = await fetch(
                `/api/search-documents?query=${encodeURIComponent(query.trim())}`
            )
            const data = await response.json()
            setDocuments(data.documents || [])
        } catch {
            setError("Failed to search documents")
        } finally {
            setIsSearching(false)
        }
    }, [])

    useEffect(() => {
        const t = setTimeout(() => performSearch(searchQuery), 300)
        return () => clearTimeout(t)
    }, [searchQuery, performSearch])

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        })

    const toggleExpanded = (docId: string) => {
        setExpandedDocs((prev) => {
            const set = new Set(prev)
            set.has(docId) ? set.delete(docId) : set.add(docId)
            return set
        })
    }

    const formatValue = (value: any): string => {
        if (Array.isArray(value)) return value.join(", ")
        if (typeof value === "object" && value !== null)
            return Object.entries(value)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" | ")
        return String(value)
    }

    const getPreviewFields = (data?: Record<string, any>) => {
        if (!data) return []
        const fields = []
        if (data.patientName)
            fields.push({ label: "Patient", value: formatValue(data.patientName) })
        if (data.hospital)
            fields.push({ label: "Hospital", value: formatValue(data.hospital) })
        if (data.diagnosis)
            fields.push({ label: "Diagnosis", value: formatValue(data.diagnosis) })
        return fields
    }

    const getAllFields = (data?: Record<string, any>) =>
        !data
            ? []
            : Object.entries(data)
                  .filter(([, v]) => v)
                  .map(([k, v]) => ({
                      label: k.replace(/([A-Z])/g, " $1"),
                      value: formatValue(v),
                  }))

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] overflow-hidden">
            {/* 🔍 Search */}
            {/* 🔍 Search */}
            <div className="sticky top-0 z-10 bg-background border-b px-3 py-3 flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by patient, document or hospital..."
                        className="pl-9 h-10 rounded-lg"
                    />
                </div>

                {/* ❌ Close Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8"
                >
                    ✕
                </Button>
            </div>


            {/* 📜 Results */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="w-4 h-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {isSearching && (
                    <div className="flex justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                )}

                {!isSearching && hasSearched && (
                    <>
                        <p className="text-xs text-muted-foreground">
                            Found {documents.length} results
                        </p>

                        <div className="grid gap-1 overflow-hidden">
                            {documents.map((doc) => {
                                const isExpanded = expandedDocs.has(doc.id)
                                const previewFields = getPreviewFields(doc.structured_data)
                                const allFields = getAllFields(doc.structured_data)

                                return (
                                    <Card
                                        key={doc.id}
                                        onClick={() => onDocumentSelect?.(doc)}
                                        className="rounded-md border p-2 hover:shadow-sm transition cursor-pointer overflow-hidden"
                                    >
                                        {/* Header */}
                                        <div className="flex justify-between items-center gap-1">
                                            <div className="flex items-center gap-1 min-w-0">
                                                <FileText className="w-3 h-3 text-muted-foreground" />
                                                <span className="text-xs font-medium truncate">
                                                    {doc.file_name}
                                                </span>
                                            </div>

                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(doc.created_at)}
                                            </span>
                                        </div>

                                        {/* Meta */}
                                        <div className="flex gap-1 mt-[2px] text-[10px]">
                                            <span className="bg-primary/10 text-primary px-1 py-[1px] rounded">
                                                {doc.document_type}
                                            </span>
                                            <span className="text-muted-foreground truncate">
                                                {doc.user_name}
                                            </span>
                                        </div>

                                        {/* Preview */}
                                        {previewFields.length > 0 && (
                                            <div className="mt-[2px] text-[11px] flex flex-wrap gap-1">
                                                {previewFields.map((f, i) => (
                                                    <span key={i} className="truncate">
                                                        <b>{f.label}:</b> {f.value}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Details toggle */}
                                        {allFields.length > 0 && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-5 px-1 mt-1 text-[10px]"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        toggleExpanded(doc.id)
                                                    }}
                                                >
                                                    {isExpanded ? (
                                                        <>
                                                            <ChevronUp className="w-3 h-3" />
                                                            Hide
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronDown className="w-3 h-3" />
                                                            Details
                                                        </>
                                                    )}
                                                </Button>

                                                {isExpanded && (
                                                    <div className="mt-1 bg-muted/40 rounded p-1 grid grid-cols-1 md:grid-cols-2 gap-[2px] text-[11px]">
                                                        {allFields.map((f, i) => (
                                                            <div key={i} className="truncate">
                                                                <b>{f.label}:</b> {f.value}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </Card>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
