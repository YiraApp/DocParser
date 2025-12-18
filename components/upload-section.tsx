"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, FileText, Loader2, CheckCircle2, Zap } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface UploadSectionProps {
  onUploadSuccess: (document: any) => void
}

export function UploadSection({ onUploadSuccess }: UploadSectionProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState("")

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const convertPdfToImages = async (pdfFile: File): Promise<File[]> => {
    try {
      console.log("[v0] Starting PDF conversion for:", pdfFile.name)
      setProgressMessage("Loading PDF library...")
      setUploadProgress(5)

      const pdfjsLib = await import("pdfjs-dist")
      console.log("[v0] pdfjs-dist loaded, version:", pdfjsLib.version)

      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

      setProgressMessage("Reading PDF file...")
      setUploadProgress(10)
      const arrayBuffer = await pdfFile.arrayBuffer()
      console.log("[v0] PDF file read, size:", arrayBuffer.byteLength)

      setProgressMessage("Loading PDF document...")
      setUploadProgress(15)
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      console.log("[v0] PDF loaded, pages:", pdf.numPages)

      const images: File[] = []
      const progressPerPage = 30 / pdf.numPages

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        setProgressMessage(`Converting page ${pageNum} of ${pdf.numPages}...`)
        setUploadProgress(15 + progressPerPage * pageNum)
        console.log("[v0] Converting page", pageNum)

        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale: 2.0 })

        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d")
        if (!context) throw new Error("Could not get canvas context")

        canvas.width = viewport.width
        canvas.height = viewport.height

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => {
              if (b) resolve(b)
              else reject(new Error("Failed to convert canvas to blob"))
            },
            "image/png",
            0.95,
          )
        })

        const imageFile = new File([blob], `${pdfFile.name.replace(".pdf", "")}_page_${pageNum}.png`, {
          type: "image/png",
        })

        console.log("[v0] Page", pageNum, "converted to image:", imageFile.name, imageFile.size)
        images.push(imageFile)
      }

      console.log("[v0] PDF conversion complete, total images:", images.length)
      return images
    } catch (error) {
      console.error("[v0] PDF conversion error:", error)
      throw new Error(`Failed to convert PDF: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a record to upload")
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
      let filesToUpload: File[] = []
      let isMultiPagePdf = false

      if (file.type === "application/pdf") {
        console.log("[v0] PDF detected, starting conversion...")
        filesToUpload = await convertPdfToImages(file)
        isMultiPagePdf = filesToUpload.length > 1
        console.log("[v0] Conversion complete, uploading", filesToUpload.length, "images")
      } else {
        console.log("[v0] Image file detected, uploading directly")
        setUploadProgress(20)
        filesToUpload = [file]
      }

      setProgressMessage(`Uploading ${filesToUpload.length} image(s)...`)
      setUploadProgress(45)

      const formData = new FormData()
      filesToUpload.forEach((file, index) => {
        formData.append("files", file)
      })
      formData.append("originalFileName", file.name)
      formData.append("isMultiPage", String(isMultiPagePdf))

      console.log("[v0] Uploading", filesToUpload.length, "files in one request")

      setProgressMessage("Uploading to server...")
      setUploadProgress(50)

      const response = await fetch("/api/parse-document", {
        method: "POST",
        body: formData,
      })

      setProgressMessage("Processing with AI...")
      setUploadProgress(75)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Upload failed" }))
        throw new Error(errorData.error || "Upload failed")
      }

      const data = await response.json()

      setProgressMessage("Processing complete!")
      setUploadProgress(100)

      await new Promise((resolve) => setTimeout(resolve, 500))

      onUploadSuccess(data)
    } catch (error) {
      console.error("[v0] Upload error:", error)
      alert(error instanceof Error ? error.message : "Failed to upload and parse record. Please try again.")
      setProgressMessage("")
      setUploadProgress(0)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
        <div className="p-8 space-y-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
              isDragging
                ? "border-primary bg-primary/5 scale-[0.99]"
                : "border-border/50 bg-muted/30 hover:border-border hover:bg-muted/50"
            }`}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileSelect}
              accept="image/png,image/jpeg,image/jpg,application/pdf"
            />

            <div className="flex flex-col items-center gap-4">
              {file ? (
                <>
                  <div className="relative">
                    <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
                      <FileText className="w-12 h-12 text-primary" />
                    </div>
                    <div className="absolute -top-1 -right-1 p-1 rounded-full bg-accent">
                      <CheckCircle2 className="w-4 h-4 text-accent-foreground" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 rounded-2xl bg-muted border border-border/50">
                    <Upload className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-medium text-foreground">Drop your medical record here</p>
                    <p className="text-sm text-muted-foreground">or click to browse files</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Supports PNG, JPG, JPEG images and PDF documents</p>
                </>
              )}

              <label htmlFor="file-upload">
                <Button
                  type="button"
                  variant={file ? "outline" : "secondary"}
                  size="lg"
                  className="cursor-pointer mt-2"
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  {file ? "Choose Different File" : "Browse Files"}
                </Button>
              </label>
            </div>
          </div>

          {isUploading && (
            <div className="space-y-3">
              <Progress value={uploadProgress} className="h-2" />
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {progressMessage}
              </div>
            </div>
          )}

          <Button onClick={handleUpload} disabled={!file || isUploading} size="lg" className="w-full gap-2 shadow-sm">
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {progressMessage || "Processing Document..."}
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Parse Medical Record
              </>
            )}
          </Button>
        </div>
      </Card>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="border border-border/50 shadow-sm hover:shadow-md transition-all hover:border-primary/30 group">
          <div className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Upload</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Drop your medical record (image or PDF) for instant AI-powered processing
            </p>
          </div>
        </Card>

        <Card className="border border-border/50 shadow-sm hover:shadow-md transition-all hover:border-accent/30 group">
          <div className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <h3 className="font-semibold text-foreground">AI Analysis</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Advanced AI extracts and structures patient data automatically
            </p>
          </div>
        </Card>

        <Card className="border border-border/50 shadow-sm hover:shadow-md transition-all hover:border-primary/30 group">
          <div className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Structured Data</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              View organized results with extracted fields and insights
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
