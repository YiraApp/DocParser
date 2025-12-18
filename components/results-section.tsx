"use client"

import { ResultsView } from "@/components/results-view"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

interface ResultsSectionProps {
  document: any
  onNewUpload: () => void
  onClose?: () => void
}

export function ResultsSection({ document, onNewUpload, onClose }: ResultsSectionProps) {
  const handleClose = () => {
    if (onClose) {
      onClose()
    } else {
      onNewUpload()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold text-foreground">Parsed Medical Record</h2>
          <p className="text-muted-foreground">AI-extracted structured data with health insights</p>
        </div>
        <Button 
          onClick={handleClose}
          variant="outline" 
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      <ResultsView document={document} />
    </div>
  )
}
