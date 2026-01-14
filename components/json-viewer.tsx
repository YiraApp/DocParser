"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Check, Download, Code2 } from "lucide-react"

interface JsonViewerProps {
    data: any
    title?: string
}

export function JsonViewer({ data, title = "Structured Data" }: JsonViewerProps) {
    const [copied, setCopied] = useState(false)

    const jsonString = JSON.stringify(data, null, 2)

    const handleCopy = async () => {
        try {
            // Check if we're in a secure context (HTTPS)
            const isSecureContext = window.isSecureContext || (typeof navigator !== 'undefined' && navigator.clipboard !== undefined)

            // Try clipboard API first (HTTPS/secure contexts)
            if (isSecureContext && navigator?.clipboard?.writeText) {
                try {
                    await navigator.clipboard.writeText(jsonString)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                    return
                } catch (clipboardErr) {
                    console.warn("Clipboard API failed, falling back to textarea method:", clipboardErr)
                }
            }

            // Fallback for HTTP or older browsers - always use textarea method
            const textArea = document.createElement("textarea")
            textArea.value = jsonString
            textArea.style.position = "fixed"
            textArea.style.left = "-999999px"
            textArea.style.top = "0"
            textArea.style.opacity = "0"
            document.body.appendChild(textArea)
            textArea.focus()
            textArea.select()
            try {
                const successful = document.execCommand("copy")
                if (successful) {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                } else {
                    alert("Failed to copy to clipboard. Please try again.")
                }
            } catch (err) {
                console.error("Fallback copy failed:", err)
                alert("Failed to copy to clipboard")
            } finally {
                document.body.removeChild(textArea)
            }
        } catch (err) {
            console.error("Failed to copy:", err)
            alert("Failed to copy to clipboard")
        }
    }

    const handleDownload = () => {
        try {
            const blob = new Blob([jsonString], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `medical-document-${Date.now()}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)

            // Cleanup with a small delay to ensure download starts
            setTimeout(() => {
                URL.revokeObjectURL(url)
            }, 100)
        } catch (err) {
            console.error("Download failed:", err)
            alert("Failed to download JSON")
        }
    }

    return (
        <Card className="border border-border/50 shadow-sm">
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                            <Code2 className="w-5 h-5 text-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleCopy} variant="outline" size="sm" className="gap-2 bg-transparent">
                            {copied ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    Copy JSON
                                </>
                            )}
                        </Button>
                        <Button onClick={handleDownload} variant="outline" size="sm" className="gap-2 bg-transparent">
                            <Download className="w-4 h-4" />
                            Download
                        </Button>
                    </div>
                </div>
                <div className="relative">
                    <pre className="p-4 rounded-lg bg-muted/50 border border-border/30 overflow-x-auto text-sm font-mono max-h-[600px] overflow-y-auto">
                        <code className="text-foreground">{jsonString}</code>
                    </pre>
                </div>
            </div>
        </Card>
    )
}