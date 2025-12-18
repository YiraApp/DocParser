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
    await navigator.clipboard.writeText(jsonString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `medical-document-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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
