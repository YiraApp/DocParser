"use client"
import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Loader2,
    ArrowLeft,
    Search,
    Download,
    User,
    Stethoscope,
    Pill,
    Building2,
    FileJson,
    Calendar,
    Hash,
    ClipboardList,
    DollarSign,
    ShieldCheck,
    ShieldAlert,
    AlertTriangle,
    AlertCircle,
    Volume2,
    VolumeX,
    FileText,
    Share2,
    TestTube,
    Activity,
    Heart,
    CheckCircle2,
    TrendingUp,
    Languages,
    Clock,
    Sparkles,
    EyeOff,
    Eye,
} from "lucide-react"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
interface ParsedDocument {
    id: string
    fileName: string
    fileUrl?: string
    uploadedAt: string
    documentType: string
    fields: Array<{ label: string; value: string }>
    summary: string
    notes: string[]
    structuredData?: any
    confidenceScore?: number
    healthRecommendations?: any
}
interface ResultsViewProps {
    document?: ParsedDocument | null
}
function normalizeField(field: any): { label: string; value: string } | null {
    if (!field) return null
    // Handle {label, value} format
    if (field.label && typeof field.label === "string") {
        return {
            label: field.label,
            value: String(field.value || ""),
        }
    }
    // Handle {fieldName, fieldValue} format
    if (field.fieldName && typeof field.fieldName === "string") {
        return {
            label: field.fieldName,
            value: String(field.fieldValue || ""),
        }
    }
    // Handle {question, answer} format
    if (field.question && typeof field.question === "string") {
        return {
            label: field.question,
            value: String(field.answer || ""),
        }
    }
    return null
}
function categorizeFields(fields: Array<any>) {
    const categories = {
        patient: [] as Array<{ label: string; value: string }>,
        medical: [] as Array<{ label: string; value: string }>,
        medications: [] as Array<{ label: string; value: string }>,
        hospital: [] as Array<{ label: string; value: string }>,
        identifiers: [] as Array<{ label: string; value: string }>,
        dates: [] as Array<{ label: string; value: string }>,
        care: [] as Array<{ label: string; value: string }>,
        billing: [] as Array<{ label: string; value: string }>,
        other: [] as Array<{ label: string; value: string }>,
    }
    const billingKeywords = [
        "total bill",
        "total amount",
        "bill amount",
        "consultation fee",
        "doctor fee",
        "room charges",
        "bed charges",
        "procedure cost",
        "surgery cost",
        "medication cost",
        "medicine cost",
        "lab test cost",
        "investigation cost",
        "other charges",
        "discount",
        "insurance",
        "payment status",
        "invoice number",
        "bill number",
        "receipt number",
        "amount paid",
        "balance due",
        "co-pay",
        "deductible",
        "claim amount",
    ]
    const identifierKeywords = [
        "mr number",
        "mrn",
        "medical record number",
        "patient id",
        "ip number",
        "admission number",
        "uhid",
        "registration number",
        "case number",
        "file number",
        "encounter id",
        "visit id",
    ]
    const medicationKeywords = [
        "medication",
        "drug",
        "prescription",
        "dosage",
        "medicine",
        "tablet",
        "capsule",
        "injection",
        "syrup",
        "dose",
        "frequency",
        "duration",
        "pharmacy",
        "rx",
        "prescribed",
    ]
    const dateKeywords = [
        "admission date",
        "discharge date",
        "report date",
        "visit date",
        "appointment date",
        "surgery date",
        "procedure date",
        "follow-up date",
        "next visit",
        "date of admission",
        "date of discharge",
    ]
    const careKeywords = [
        "dietary advice",
        "diet plan",
        "nutrition",
        "follow-up instructions",
        "follow up",
        "discharge instructions",
        "home care",
        "lifestyle modifications",
        "activity restrictions",
        "precautions",
        "care plan",
        "recommendations",
    ]
    const medicalKeywords = [
        "diagnosis",
        "procedure performed",
        "treatment given",
        "condition",
        "symptoms",
        "findings",
        "examination",
        "assessment",
        "impression",
        "clinical notes",
        "vital signs",
        "vitals",
        "blood pressure",
        "heart rate",
        "pulse",
        "temperature",
        "spo2",
        "oxygen saturation",
        "respiratory rate",
        "imaging results",
        "radiology",
        "x-ray",
        "ct scan",
        "mri",
        "ultrasound",
        "pathology",
        "biopsy",
        "ecg",
        "angiography",
        "allergies",
        "allergy",
    ]
    const hospitalKeywords = [
        "hospital name",
        "facility",
        "department",
        "doctor name",
        "consultant",
        "physician",
        "specialist",
        "surgeon",
        "attending doctor",
        "referring doctor",
        "provider",
        "ward",
        "unit",
        "clinic",
    ]
    const patientKeywords = [
        "patient name",
        "age",
        "gender",
        "sex",
        "date of birth",
        "dob",
        "contact number",
        "phone",
        "mobile",
        "address",
        "email",
        "emergency contact",
        "next of kin",
        "guardian",
        "marital status",
        "occupation",
        "blood group",
    ]
    fields.forEach((field) => {
        const normalizedField = normalizeField(field)
        if (!normalizedField) {
            console.warn("[v0] Skipping invalid field (could not normalize):", field)
            return
        }
        const labelLower = normalizedField.label.toLowerCase()
        if (billingKeywords.some((kw) => labelLower.includes(kw))) {
            categories.billing.push(normalizedField)
        } else if (identifierKeywords.some((kw) => labelLower.includes(kw))) {
            categories.identifiers.push(normalizedField)
        } else if (medicationKeywords.some((kw) => labelLower.includes(kw))) {
            categories.medications.push(normalizedField)
        } else if (dateKeywords.some((kw) => labelLower.includes(kw))) {
            categories.dates.push(normalizedField)
        } else if (careKeywords.some((kw) => labelLower.includes(kw))) {
            categories.care.push(normalizedField)
        } else if (medicalKeywords.some((kw) => labelLower.includes(kw))) {
            categories.medical.push(normalizedField)
        } else if (hospitalKeywords.some((kw) => labelLower.includes(kw))) {
            categories.hospital.push(normalizedField)
        } else if (patientKeywords.some((kw) => labelLower.includes(kw))) {
            categories.patient.push(normalizedField)
        } else {
            categories.other.push(normalizedField)
        }
    })
    return categories
}
export function ResultsView({ document: initialDocument }: ResultsViewProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [document, setDocument] = useState<any>(initialDocument || null)
    // Initialize isLoading based on whether initialDocument is provided
    const [isLoading, setIsLoading] = useState(!initialDocument)
    const [error, setError] = useState<string | null>(null)
    const [selectedLanguage, setSelectedLanguage] = useState<string>("en")
    const [translatedContent, setTranslatedContent] = useState<any>(null)
    const [translatedRecommendations, setTranslatedRecommendations] = useState<any>(null)
    const [isTranslating, setIsTranslating] = useState(false)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
    const [showRecommendations, setShowRecommendations] = useState(true)
    useEffect(() => {
        if (initialDocument) {
            setDocument(initialDocument)
            setIsLoading(false)
            setError(null)
            return
        }
        const documentId = searchParams?.get("id")
        if (!documentId) {
            setError("No document ID provided")
            setIsLoading(false)
            return
        }
        const abortController = new AbortController()
        fetch(`/api/parse-document?id=${documentId}`, { signal: abortController.signal })
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch record")
                return res.json()
            })
            .then((data) => {
                console.log("[v0] Document data loaded:", data)
                setDocument(data)
                setIsLoading(false)
            })
            .catch((err) => {
                if (err.name === "AbortError") return
                console.error("[v0] Fetch error:", err)
                setError("Failed to load record")
                setIsLoading(false)
            })
        return () => abortController.abort()
    }, [searchParams, initialDocument]) // Depend on searchParams for dynamic ID changes
    const handleLanguageChange = async (language: string) => {
        // Stop any playing audio when language changes
        if (currentAudio) {
            currentAudio.pause()
            setIsSpeaking(false)
            setCurrentAudio(null)
        }
        setSelectedLanguage(language)
        if (language === "en") {
            setTranslatedContent(null) // Keep this line to reset content translation
            setTranslatedRecommendations(null)
            return
        }
        if (!document?.healthRecommendations) {
            console.log("[v0] No health recommendations to translate")
            return
        }
        setIsTranslating(true)
        try {
            console.log("[v0] Starting translation to:", language)
            console.log("[v0] Recommendations to translate:", document.healthRecommendations)
            const response = await fetch("/api/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: document.healthRecommendations,
                    targetLanguage: language,
                }),
            })
            if (!response.ok) {
                const errorText = await response.text()
                console.error("[v0] Translation API error:", response.status, errorText)
                throw new Error(`Translation failed: ${response.status} - ${errorText}`)
            }
            const data = await response.json()
            console.log("[v0] Translation successful, received data:", data)
            console.log("[v0] Setting translatedRecommendations:", data.translatedRecommendations)
            setTranslatedRecommendations(data.translatedRecommendations)
        } catch (error) {
            console.error("[v0] Translation error:", error)
            alert(
                `Failed to translate content: ${error instanceof Error ? error.message : "Unknown error"}. Please check if GOOGLE_TRANSLATE_KEY is configured.`,
            )
            setSelectedLanguage("en")
        } finally {
            setIsTranslating(false)
        }
    }
    const handleReadAloud = async () => {
        if (isSpeaking) {
            if (currentAudio) {
                currentAudio.pause()
                setCurrentAudio(null)
            }
            window.speechSynthesis.cancel()
            setIsSpeaking(false)
            return
        }
        const recommendations = getDisplayRecommendations()
        if (!recommendations) {
            alert("No recommendations available to read")
            return
        }
        let textToRead = "AI Health Recommendations.\n\n"
        if (recommendations.recommendations?.length > 0) {
            textToRead += "Key Recommendations:\n"
            recommendations.recommendations.forEach((rec: any, idx: number) => {
                textToRead += `${idx + 1}. ${rec.recommendation}\n`
                if (rec.reason) textToRead += `Reason: ${rec.reason}\n`
            })
            textToRead += "\n"
        }
        if (recommendations.warnings?.length > 0) {
            textToRead += "Important Warnings:\n"
            recommendations.warnings.forEach((warning: any, idx: number) => {
                textToRead += `${idx + 1}. ${warning.warning}\n`
                if (warning.action) textToRead += `Action: ${warning.action}\n`
            })
            textToRead += "\n"
        }
        if (recommendations.nextSteps?.length > 0) {
            textToRead += "Next Steps:\n"
            recommendations.nextSteps.forEach((step: string, idx: number) => {
                textToRead += `${idx + 1}. ${step}\n`
            })
        }
        // Use browser's Web Speech API
        const languageMap: { [key: string]: string } = {
            en: "en-US",
            hi: "hi-IN",
            te: "te-IN",
            kn: "kn-IN",
            ta: "ta-IN",
            bn: "bn-IN",
        }
        const langCode = languageMap[selectedLanguage] || "en-US"
        try {
            setIsSpeaking(true)
            console.log("[v0] Using Web Speech API for language:", langCode)
            // Check if speech synthesis is available
            if (!window.speechSynthesis) {
                throw new Error("Speech synthesis not supported in this browser")
            }
            // Cancel any ongoing speech
            window.speechSynthesis.cancel()
            const utterance = new SpeechSynthesisUtterance(textToRead)
            utterance.lang = langCode
            utterance.rate = 0.9
            utterance.pitch = 1.0
            utterance.volume = 1.0
            // Try to find the best voice for the language
            const voices = window.speechSynthesis.getVoices()
            const preferredVoice = voices.find((voice) => voice.lang === langCode || voice.lang.startsWith(selectedLanguage))
            if (preferredVoice) {
                utterance.voice = preferredVoice
                console.log("[v0] Using voice:", preferredVoice.name)
            } else {
                console.log("[v0] No specific voice found for", langCode, "using default")
            }
            utterance.onend = () => {
                console.log("[v0] Speech synthesis ended")
                setIsSpeaking(false)
            }
            utterance.onerror = (event) => {
                console.error("[v0] Speech synthesis error:", event.error)
                setIsSpeaking(false)
                alert(`Speech failed: ${event.error}`)
            }
            window.speechSynthesis.speak(utterance)
        } catch (error: any) {
            console.error("[v0] Text-to-speech error:", error)
            alert(`Text-to-speech failed: ${error.message}`)
            setIsSpeaking(false)
        }
    }
    const getDisplayContent = () => {
        if (selectedLanguage === "en" || !translatedContent) {
            return document?.structuredData
        }
        return translatedContent
    }
    const getDisplayRecommendations = () => {
        console.log("[v0] getDisplayRecommendations called")
        console.log("[v0] selectedLanguage:", selectedLanguage)
        console.log("[v0] translatedRecommendations:", translatedRecommendations)
        console.log("[v0] document.healthRecommendations:", document?.healthRecommendations)
        if (selectedLanguage !== "en" && translatedRecommendations) {
            console.log("[v0] Returning translated recommendations")
            console.log("[v0] Translated recommendations structure:", {
                hasRecommendations: !!translatedRecommendations.recommendations,
                recommendationsCount: translatedRecommendations.recommendations?.length || 0,
                hasWarnings: !!translatedRecommendations.warnings,
                warningsCount: translatedRecommendations.warnings?.length || 0,
                hasNextSteps: !!translatedRecommendations.nextSteps,
                nextStepsCount: translatedRecommendations.nextSteps?.length || 0,
            })
            return translatedRecommendations
        }
        console.log("[v0] Returning original recommendations")
        console.log("[v0] Original recommendations structure:", {
            hasRecommendations: !!document?.healthRecommendations?.recommendations,
            recommendationsCount: document?.healthRecommendations?.recommendations?.length || 0,
            hasWarnings: !!document?.healthRecommendations?.warnings,
            warningsCount: document?.healthRecommendations?.warnings?.length || 0,
            hasNextSteps: !!document?.healthRecommendations?.nextSteps,
            nextStepsCount: document?.healthRecommendations?.nextSteps?.length || 0,
        })
        return document?.healthRecommendations
    }
    const getConfidenceDisplay = (score: number | undefined) => {
        if (score === undefined || score === null) {
            return {
                color: "text-gray-500",
                bgColor: "bg-gray-500/10",
                borderColor: "border-gray-500/20",
                label: "Unknown",
                icon: ShieldAlert,
                description: "Confidence score not available",
            }
        }
        if (score >= 90) {
            return {
                color: "text-green-600",
                bgColor: "bg-green-500/10",
                borderColor: "border-green-500/20",
                label: "Very High",
                icon: ShieldCheck,
                description: "Excellent data quality and completeness",
            }
        } else if (score >= 70) {
            return {
                color: "text-blue-600",
                bgColor: "bg-blue-500/10",
                borderColor: "border-blue-500/20",
                label: "High",
                icon: ShieldCheck,
                description: "Good data quality with minor gaps",
            }
        } else if (score >= 50) {
            return {
                color: "text-yellow-600",
                bgColor: "bg-yellow-500/10",
                borderColor: "border-yellow-500/20",
                label: "Moderate",
                icon: AlertTriangle,
                description: "Acceptable quality, some information unclear",
            }
        } else if (score >= 30) {
            return {
                color: "text-orange-600",
                bgColor: "bg-orange-500/10",
                borderColor: "border-orange-500/20",
                label: "Low",
                icon: AlertTriangle,
                description: "Limited data quality, verify manually",
            }
        } else {
            return {
                color: "text-red-600",
                bgColor: "bg-red-500/10",
                borderColor: "border-red-500/20",
                label: "Very Low",
                icon: ShieldAlert,
                description: "Poor data quality, manual review required",
            }
        }
    }
    const confidenceDisplay = getConfidenceDisplay(document?.confidenceScore)
    const ConfidenceIcon = confidenceDisplay.icon
    const categorizedFields = categorizeFields(document?.fields || [])
    // Enhanced patient name extraction to fix "Unknown Patient" issue
    const patientNameField = categorizedFields.patient.find(field =>
        field.label.toLowerCase().includes('patient name') ||
        field.label.toLowerCase().includes('name') ||
        field.label.toLowerCase().includes('full name') ||
        field.label.toLowerCase().includes('patient full name')
    ) || categorizedFields.other.find(field =>
        field.label.toLowerCase().includes('name') ||
        field.label.toLowerCase().includes('patient')
    )
    const patientName = patientNameField
        ? patientNameField.value
        : (document?.structuredData?.patientInfo?.fullName ||
            document?.structuredData?.patientInfo?.name ||
            document?.structuredData?.patient?.name ||
            "Patient Record")
    const cleanDownloadFilename = document?.fileName ? document.fileName.replace(/\.(pdf|PDF)$/i, ".png") : "document.png"
    const handleDownloadJSON = () => {
        if (!document?.structuredData) return
        const jsonString = JSON.stringify(document.structuredData, null, 2)
        const blob = new Blob([jsonString], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = window.document.createElement("a")
        a.href = url
        a.download = document.fileName ? document.fileName.replace(/\.(pdf|PDF)$/i, ".json") : "document.json"
        window.document.body.appendChild(a)
        a.click()
        window.document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }
    const renderFieldValue = (value: any): string => {
        if (value === null || value === undefined) {
            return "N/A"
        }
        if (typeof value === "object") {
            // Handle objects by converting to readable format
            if (Array.isArray(value)) {
                return value.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(", ")
            }
            // For objects like {answer, question}, format them nicely
            if (value.question && value.answer) {
                return `Q: ${value.question}\nA: ${value.answer}`
            }
            return JSON.stringify(value, null, 2)
        }
        return String(value)
    }
    // Added loading and error state handling
    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        )
    }
    if (error) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen text-center space-y-3">
                <AlertTriangle className="w-10 h-10 text-red-600" />
                <h2 className="text-xl font-bold text-foreground">Error loading record</h2>
                <p className="text-muted-foreground">{error}</p>
                {/* Use router.push */}
                <Button onClick={() => router.push("/")} variant="outline" className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Go Back
                </Button>
            </div>
        )
    }
    // Added check for document existence
    if (!document) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen text-center space-y-3">
                <AlertTriangle className="w-10 h-10 text-red-600" />
                <h2 className="text-xl font-bold text-foreground">No record found</h2>
                <p className="text-muted-foreground">The requested record could not be loaded or does not exist.</p>
                {/* Use router.push */}
                <Button onClick={() => router.push("/")} variant="outline" className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Go Back
                </Button>
            </div>
        )
    }
    const displayRecommendations = getDisplayRecommendations()
    const handleDownload = () => {
        const dataStr = JSON.stringify(document.structuredData, null, 2)
        const dataBlob = new Blob([dataStr], { type: "application/json" })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement("a")
        link.href = url
        link.download = `${document.fileName.replace(/\.[^/.]+$/, "")}_parsed.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }
    const handleShare = async () => {
        const shareData = {
            title: `Medical Record - ${patientName}`,
            text: `Parsed medical document for ${patientName}`,
            url: window.location.href,
        }
        if (navigator.share) {
            try {
                await navigator.share(shareData)
            } catch (err) {
                // User cancelled or share failed
            }
        } else {
            navigator.clipboard.writeText(window.location.href)
            alert("Link copied to clipboard!")
        }
    }
    const structuredData = document.structuredData
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "high":
                return "destructive"
            case "medium":
                return "default"
            case "low":
                return "secondary"
            default:
                return "outline"
        }
    }
    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "critical":
            case "high":
                return "destructive"
            case "medium":
                return "default"
            case "low":
                return "secondary"
            default:
                return "outline"
        }
    }
    const getCategoryIcon = (category: string) => {
        switch (category) {
            case "medication":
                return <Pill className="w-3 h-3" />
            case "lifestyle":
                return <Activity className="w-3 h-3" />
            case "followup":
                return <Calendar className="w-3 h-3" />
            case "monitoring":
                return <Heart className="w-3 h-3" />
            case "diet":
                return <ClipboardList className="w-3 h-3" />
            case "exercise":
                return <TrendingUp className="w-3 h-3" />
            default:
                return <CheckCircle2 className="w-3 h-3" />
        }
    }
    return (
        <div className="space-y-4">
            {/* Header Section */}
            <Card className="border border-border/50 shadow-sm">
                <div className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-xl font-bold text-foreground">
                                    {patientName}
                                </h2>
                                <Badge variant="outline" className="gap-1">
                                    <FileText className="w-3 h-3" />
                                    {structuredData?.documentInfo?.type || "Medical Document"}
                                </Badge>
                                {document.confidenceScore && (
                                    <Badge
                                        variant={
                                            document.confidenceScore >= 80
                                                ? "default"
                                                : document.confidenceScore >= 60
                                                    ? "secondary"
                                                    : "destructive"
                                        }
                                        className="gap-1"
                                    >
                                        <CheckCircle2 className="w-3 h-3" />
                                        {document.confidenceScore}% Confidence
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {structuredData?.documentInfo?.reportDate || "Date not available"}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Building2 className="w-3 h-3" />
                                    {structuredData?.providerInfo?.hospitalName || "Hospital not specified"}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Uploaded {new Date(document.uploadedAt).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                            {/*<Select value={selectedLanguage} onValueChange={handleLanguageChange}>*/}
                            {/*    <SelectTrigger className="w-[120px]">*/}
                            {/*        <Languages className="w-3 h-3 mr-1" />*/}
                            {/*        <SelectValue />*/}
                            {/*    </SelectTrigger>*/}
                            {/*    <SelectContent>*/}
                            {/*        <SelectItem value="en">English</SelectItem>*/}
                            {/*        <SelectItem value="hi">?????</SelectItem>*/}
                            {/*        <SelectItem value="te">??????</SelectItem>*/}
                            {/*        <SelectItem value="kn">?????</SelectItem>*/}
                            {/*        <SelectItem value="ta">?????</SelectItem>*/}
                            {/*        <SelectItem value="bn">?????</SelectItem>*/}
                            {/*    </SelectContent>*/}
                            {/*</Select>*/}
                            <Button variant="outline" size="sm" onClick={handleReadAloud} disabled={!displayRecommendations}>
                                {isSpeaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1 bg-transparent">
                                <Download className="w-3 h-3" />
                                <span className="hidden sm:inline">Export</span>
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleShare} className="gap-1 bg-transparent">
                                <Share2 className="w-3 h-3" />
                                <span className="hidden sm:inline">Share</span>
                            </Button>
                        </div>
                    </div>
                    {isTranslating && (
                        <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Translating content...
                        </div>
                    )}
                </div>
            </Card>
            <Tabs defaultValue="overview" className="space-y-3">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="clinical">Clinical</TabsTrigger>
                    <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                    <TabsTrigger value="raw">Raw Data</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-3">
                    <div className="grid md:grid-cols-2 gap-3">
                        {/* Patient Information - Integrated with categorized patient fields */}
                        <Card className="border border-border/50">
                            <div className="p-4 space-y-3">
                                <div className="flex items-center gap-1">
                                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                                        <User className="w-3 h-3 text-primary" />
                                    </div>
                                    <h3 className="font-semibold text-foreground">Patient Information</h3>
                                </div>
                                <div className="space-y-2">
                                    {patientName !== "Patient Record" && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">Name</p>
                                            <p className="text-sm font-medium text-foreground">{patientName}</p>
                                        </div>
                                    )}
                                    {structuredData?.patientInfo?.dateOfBirth && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">Date of Birth</p>
                                            <p className="text-sm font-medium text-foreground">{structuredData.patientInfo.dateOfBirth}</p>
                                        </div>
                                    )}
                                    {structuredData?.patientInfo?.age && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">Age</p>
                                            <p className="text-sm font-medium text-foreground">{structuredData.patientInfo.age}</p>
                                        </div>
                                    )}
                                    {structuredData?.patientInfo?.gender && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">Gender</p>
                                            <p className="text-sm font-medium text-foreground">{structuredData.patientInfo.gender}</p>
                                        </div>
                                    )}
                                    {structuredData?.patientInfo?.medicalRecordNumber && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">Medical Record Number</p>
                                            <p className="text-sm font-medium text-foreground">
                                                {structuredData.patientInfo.medicalRecordNumber}
                                            </p>
                                        </div>
                                    )}
                                    {/* Bind categorized patient fields here for overview */}
                                    {categorizedFields.patient.length > 0 && (
                                        <div className="space-y-2 mt-2 pt-2 border-t border-border/50">
                                            <p className="text-xs font-semibold text-muted-foreground">Additional Details</p>
                                            {categorizedFields.patient.map((field, index) => (
                                                <div key={index} className="space-y-1">
                                                    <p className="text-xs text-muted-foreground">{field.label}</p>
                                                    <p className="text-sm font-medium text-foreground">{renderFieldValue(field.value)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                        {/* Provider Information - Integrated with categorized hospital fields */}
                        <Card className="border border-border/50">
                            <div className="p-4 space-y-3">
                                <div className="flex items-center gap-1">
                                    <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center">
                                        <Building2 className="w-3 h-3 text-accent" />
                                    </div>
                                    <h3 className="font-semibold text-foreground">Healthcare Provider</h3>
                                </div>
                                <div className="space-y-2">
                                    {structuredData?.providerInfo?.hospitalName && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">Hospital/Clinic</p>
                                            <p className="text-sm font-medium text-foreground">{structuredData.providerInfo.hospitalName}</p>
                                        </div>
                                    )}
                                    {structuredData?.providerInfo?.department && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">Department</p>
                                            <p className="text-sm font-medium text-foreground">{structuredData.providerInfo.department}</p>
                                        </div>
                                    )}
                                    {structuredData?.providerInfo?.doctorName && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">Doctor</p>
                                            <p className="text-sm font-medium text-foreground">{structuredData.providerInfo.doctorName}</p>
                                        </div>
                                    )}
                                    {/* Bind categorized hospital fields here for overview */}
                                    {categorizedFields.hospital.length > 0 && (
                                        <div className="space-y-2 mt-2 pt-2 border-t border-border/50">
                                            <p className="text-xs font-semibold text-muted-foreground">Additional Details</p>
                                            {categorizedFields.hospital.map((field, index) => (
                                                <div key={index} className="space-y-1">
                                                    <p className="text-xs text-muted-foreground">{field.label}</p>
                                                    <p className="text-sm font-medium text-foreground">{renderFieldValue(field.value)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>
                    {/* Document Summary */}
                    {structuredData?.documentSummary && (
                        <Card className="border border-border/50">
                            <div className="p-4 space-y-2">
                                <div className="flex items-center gap-1">
                                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                                        <FileText className="w-3 h-3 text-primary" />
                                    </div>
                                    <h3 className="font-semibold text-foreground">Document Summary</h3>
                                </div>
                                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                                    {structuredData.documentSummary}
                                </p>
                            </div>
                        </Card>
                    )}
                    {/* Bind identifiers and dates to overview as they are general */}
                    {categorizedFields.identifiers.length > 0 && (
                        <Card className="border border-indigo-500/20 bg-indigo-500/5 shadow-sm">
                            <div className="p-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-indigo-500/10">
                                        <Hash className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-semibold text-foreground">Medical Record Identifiers</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Patient and admission identification numbers</p>
                                    </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {categorizedFields.identifiers.map((field, index) => (
                                        <div key={index} className="p-3 rounded-md bg-background border border-border/50 space-y-1">
                                            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">{field.label}</p>
                                            <p className="text-foreground leading-relaxed text-pretty whitespace-pre-wrap">
                                                {renderFieldValue(field.value)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    )}
                    {categorizedFields.dates.length > 0 && (
                        <Card className="border border-cyan-500/20 bg-cyan-500/5 shadow-sm">
                            <div className="p-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-cyan-500/10">
                                        <Calendar className="w-4 h-4 text-cyan-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-semibold text-foreground">Important Dates</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Admission, discharge, and other key dates</p>
                                    </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {categorizedFields.dates.map((field, index) => (
                                        <div key={index} className="p-3 rounded-md bg-background border border-border/50 space-y-1">
                                            <p className="text-xs font-semibold text-cyan-600 uppercase tracking-wide">{field.label}</p>
                                            <p className="text-foreground leading-relaxed text-pretty whitespace-pre-wrap">
                                                {renderFieldValue(field.value)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    )}
                </TabsContent>
                <TabsContent value="clinical" className="space-y-3">
                    {/* Diagnosis */}
                    {structuredData?.clinicalData?.diagnosis && (
                        <Card className="border border-border/50">
                            <div className="p-4 space-y-2">
                                <div className="flex items-center gap-1">
                                    <div className="w-6 h-6 rounded-md bg-destructive/10 flex items-center justify-center">
                                        <Stethoscope className="w-3 h-3 text-destructive" />
                                    </div>
                                    <h3 className="font-semibold text-foreground">Diagnosis</h3>
                                </div>
                                <p className="text-sm text-foreground">{structuredData.clinicalData.diagnosis}</p>
                                {structuredData.clinicalData.secondaryDiagnoses &&
                                    structuredData.clinicalData.secondaryDiagnoses.length > 0 && (
                                        <div className="pt-1">
                                            <p className="text-xs text-muted-foreground mb-1">Secondary Diagnoses:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {structuredData.clinicalData.secondaryDiagnoses.map((diagnosis: string, idx: number) => (
                                                    <Badge key={idx} variant="outline">
                                                        {diagnosis}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                            </div>
                        </Card>
                    )}
                    {/* Medications */}
                    {structuredData?.clinicalData?.medications && structuredData.clinicalData.medications.length > 0 && (
                        <Card className="border border-border/50">
                            <div className="p-4 space-y-3">
                                <div className="flex items-center gap-1">
                                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                                        <Pill className="w-3 h-3 text-primary" />
                                    </div>
                                    <h3 className="font-semibold text-foreground">Medications</h3>
                                </div>
                                <div className="space-y-2">
                                    {structuredData.clinicalData.medications.map((med: any, idx: number) => (
                                        <div key={idx} className="p-2 bg-muted/30 rounded-md border border-border/30">
                                            <p className="text-sm font-semibold text-foreground">{med.name}</p>
                                            <div className="mt-1 grid grid-cols-3 gap-1 text-xs">
                                                {med.dosage && (
                                                    <div>
                                                        <span className="text-muted-foreground">Dosage:</span>
                                                        <p className="font-medium text-foreground">{med.dosage}</p>
                                                    </div>
                                                )}
                                                {med.frequency && (
                                                    <div>
                                                        <span className="text-muted-foreground">Frequency:</span>
                                                        <p className="font-medium text-foreground">{med.frequency}</p>
                                                    </div>
                                                )}
                                                {med.duration && (
                                                    <div>
                                                        <span className="text-muted-foreground">Duration:</span>
                                                        <p className="font-medium text-foreground">{med.duration}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    )}
                    {/* Lab Results */}
                    {structuredData?.clinicalData?.labResults && structuredData.clinicalData.labResults.length > 0 && (
                        <Card className="border border-border/50">
                            <div className="p-4 space-y-3">
                                <div className="flex items-center gap-1">
                                    <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center">
                                        <TestTube className="w-3 h-3 text-accent" />
                                    </div>
                                    <h3 className="font-semibold text-foreground">Lab Results</h3>
                                </div>
                                <div className="space-y-1">
                                    {structuredData.clinicalData.labResults.map((result: any, idx: number) => (
                                        <div key={idx} className="p-2 bg-muted/30 rounded-md border border-border/30">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-semibold text-foreground">{result.test}</p>
                                                {result.status && (
                                                    <Badge
                                                        variant={
                                                            result.status === "Normal"
                                                                ? "default"
                                                                : result.status === "High" || result.status === "Low"
                                                                    ? "secondary"
                                                                    : "destructive"
                                                        }
                                                    >
                                                        {result.status}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="mt-1 grid grid-cols-2 gap-1 text-xs">
                                                <div>
                                                    <span className="text-muted-foreground">Value:</span>
                                                    <p className="font-medium text-foreground">
                                                        {result.measuredValue} {result.unit}
                                                    </p>
                                                </div>
                                                {result.referenceRange && (
                                                    <div>
                                                        <span className="text-muted-foreground">Reference:</span>
                                                        <p className="font-medium text-foreground">{result.referenceRange}</p>
                                                    </div>
                                                )}
                                            </div>
                                            {result.notes && <p className="mt-1 text-xs text-muted-foreground italic">{result.notes}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    )}
                    {/* Vital Signs */}
                    {structuredData?.clinicalData?.vitalSigns &&
                        Object.values(structuredData.clinicalData.vitalSigns).some((v) => v !== null) && (
                            <Card className="border border-border/50">
                                <div className="p-4 space-y-3">
                                    <div className="flex items-center gap-1">
                                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                                            <Activity className="w-3 h-3 text-primary" />
                                        </div>
                                        <h3 className="font-semibold text-foreground">Vital Signs</h3>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {Object.entries(structuredData.clinicalData.vitalSigns).map(
                                            ([key, value]: [string, any]) =>
                                                value && (
                                                    <div key={key} className="space-y-1">
                                                        <p className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</p>
                                                        <p className="text-sm font-semibold text-foreground">{value}</p>
                                                    </div>
                                                ),
                                        )}
                                    </div>
                                </div>
                            </Card>
                        )}
                    {/* Bind medical, medications, and lab results categorized fields to clinical tab */}
                    {categorizedFields.medical.length > 0 && (
                        <Card className="border border-red-500/20 bg-red-500/5 shadow-sm">
                            <div className="p-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-red-500/10">
                                        <Stethoscope className="w-4 h-4 text-red-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-semibold text-foreground">Medical Details</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Diagnosis, procedures, and vital signs</p>
                                    </div>
                                </div>
                                <div className="grid gap-3">
                                    {categorizedFields.medical.map((field, index) => (
                                        <div key={index} className="p-3 rounded-md bg-background border border-border/50 space-y-1">
                                            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">{field.label}</p>
                                            <p className="text-foreground leading-relaxed text-pretty whitespace-pre-wrap">
                                                {renderFieldValue(field.value)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    )}
                    {categorizedFields.medications.length > 0 && (
                        <Card className="border border-green-500/20 bg-green-500/5 shadow-sm">
                            <div className="p-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-green-500/10">
                                        <Pill className="w-4 h-4 text-green-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-semibold text-foreground">Medications</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Prescribed medications with dosages</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {categorizedFields.medications.map((field, index) => {
                                        const valueStr = renderFieldValue(field.value)
                                        const medications = valueStr
                                            .split(/[,;\n]|(?=\d+\.)/)
                                            .map((med) => med.trim())
                                            .filter((med) => med.length > 0)
                                        return (
                                            <div key={index} className="space-y-2">
                                                <p className="text-sm font-semibold text-green-600 uppercase tracking-wide">{field.label}</p>
                                                <div className="space-y-1">
                                                    {medications.map((medication, medIndex) => (
                                                        <div
                                                            key={medIndex}
                                                            className="flex gap-2 p-2 rounded-md bg-background border border-green-500/20 hover:border-green-500/40 transition-colors"
                                                        >
                                                            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center mt-0.5">
                                                                <Pill className="w-2.5 h-2.5 text-green-600" />
                                                            </div>
                                                            <p className="text-foreground leading-relaxed flex-1">
                                                                {medication.replace(/^\d+\.\s*/, "")}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </Card>
                    )}
                    {document?.structuredData?.medical?.labResults && document.structuredData.medical.labResults.length > 0 && (
                        <Card className="border border-violet-500/20 bg-violet-500/5 shadow-sm">
                            <div className="p-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-violet-500/10">
                                        <Stethoscope className="w-4 h-4 text-violet-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-semibold text-foreground">Laboratory Results</h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Test results with measured values and reference ranges
                                        </p>
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    {document.structuredData.medical.labResults.map((result: any, index: number) => {
                                        const getStatusColor = (status: string) => {
                                            if (!status) return "text-gray-600 bg-gray-500/10 border-gray-500/20"
                                            const statusLower = status.toLowerCase()
                                            if (statusLower === "normal") return "text-green-600 bg-green-500/10 border-green-500/20"
                                            if (statusLower === "high") return "text-orange-600 bg-orange-500/10 border-orange-500/20"
                                            if (statusLower === "low") return "text-blue-600 bg-blue-500/10 border-blue-500/20"
                                            if (statusLower === "critical") return "text-red-600 bg-red-500/10 border-red-500/20"
                                            return "text-gray-600 bg-gray-500/10 border-gray-500/20"
                                        }
                                        const statusColor = getStatusColor(result.status)
                                        return (
                                            <div
                                                key={index}
                                                className="p-3 rounded-md bg-background border border-violet-500/20 hover:border-violet-500/40 transition-colors"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex items-center gap-1">
                                                            <p className="text-sm font-semibold text-violet-600">{result.test}</p>
                                                            {result.status && (
                                                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full border ${statusColor}`}>
                                                                    {result.status}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Measured Value</p>
                                                                <p className="text-base font-bold text-foreground">
                                                                    {result.measuredValue || result.result}{" "}
                                                                    <span className="text-xs font-normal text-muted-foreground">{result.unit}</span>
                                                                </p>
                                                            </div>
                                                            {result.referenceRange && (
                                                                <div>
                                                                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                                                                        Reference Range
                                                                    </p>
                                                                    <p className="text-sm font-semibold text-foreground">
                                                                        {result.referenceRange}{" "}
                                                                        <span className="text-xs font-normal text-muted-foreground">{result.unit}</span>
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {result.notes && (
                                                            <p className="text-xs text-muted-foreground italic border-l-2 border-violet-500/30 pl-2">
                                                                {result.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </Card>
                    )}
                </TabsContent>
                <TabsContent value="recommendations" className="space-y-3">
                    {displayRecommendations ? (
                        <>
                            {/* Summary */}
                            {displayRecommendations.summary && (
                                <Card className="border border-primary/20 bg-primary/5">
                                    <div className="p-4 space-y-2">
                                        <div className="flex items-center gap-1">
                                            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                                                <Heart className="w-3 h-3 text-primary" />
                                            </div>
                                            <h3 className="font-semibold text-foreground">Health Overview</h3>
                                        </div>
                                        <p className="text-sm text-foreground leading-relaxed">{displayRecommendations.summary}</p>
                                    </div>
                                </Card>
                            )}
                            {/* Recommendations */}
                            {displayRecommendations.recommendations && displayRecommendations.recommendations.length > 0 && (
                                <Card className="border border-border/50">
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-center gap-1">
                                            <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center">
                                                <CheckCircle2 className="w-3 h-3 text-accent" />
                                            </div>
                                            <h3 className="font-semibold text-foreground">Personalized Recommendations</h3>
                                        </div>
                                        <div className="space-y-2">
                                            {displayRecommendations.recommendations.map((rec: any, idx: number) => (
                                                <div key={idx} className="p-3 bg-muted/30 rounded-md border border-border/30 space-y-1">
                                                    <div className="flex items-start gap-2">
                                                        <div className="p-1.5 rounded-md bg-background">{getCategoryIcon(rec.category)}</div>
                                                        <div className="flex-1 space-y-1">
                                                            <div className="flex items-center gap-1 flex-wrap">
                                                                <Badge variant={getPriorityColor(rec.priority)}>{rec.priority} priority</Badge>
                                                                <Badge variant="outline">{rec.category}</Badge>
                                                            </div>
                                                            <p className="text-sm text-foreground leading-relaxed">{rec.recommendation}</p>
                                                            {rec.reason && (
                                                                <p className="text-xs text-muted-foreground italic">Reason: {rec.reason}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Card>
                            )}
                            {/* Warnings */}
                            {displayRecommendations.warnings && displayRecommendations.warnings.length > 0 && (
                                <Card className="border border-destructive/50 bg-destructive/5">
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-center gap-1">
                                            <div className="w-6 h-6 rounded-md bg-destructive/10 flex items-center justify-center">
                                                <AlertTriangle className="w-3 h-3 text-destructive" />
                                            </div>
                                            <h3 className="font-semibold text-foreground">Important Warnings</h3>
                                        </div>
                                        <div className="space-y-2">
                                            {displayRecommendations.warnings.map((warning: any, idx: number) => (
                                                <div key={idx} className="p-3 bg-background rounded-md border border-destructive/30 space-y-1">
                                                    <div className="flex items-start gap-2">
                                                        <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                                                        <div className="flex-1 space-y-1">
                                                            <div className="flex items-center gap-1">
                                                                <Badge variant={getSeverityColor(warning.severity)}>{warning.severity}</Badge>
                                                            </div>
                                                            <p className="text-sm text-foreground font-medium">{warning.warning}</p>
                                                            {warning.action && (
                                                                <p className="text-sm text-muted-foreground">
                                                                    <strong>Action:</strong> {warning.action}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Card>
                            )}
                            {/* Next Steps */}
                            {displayRecommendations.nextSteps && displayRecommendations.nextSteps.length > 0 && (
                                <Card className="border border-border/50">
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-center gap-1">
                                            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                                                <ClipboardList className="w-3 h-3 text-primary" />
                                            </div>
                                            <h3 className="font-semibold text-foreground">Next Steps</h3>
                                        </div>
                                        <ul className="space-y-1">
                                            {displayRecommendations.nextSteps.map((step: string, idx: number) => (
                                                <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                                                    <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                                                    <span>{step}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </Card>
                            )}
                            {/* Bind care instructions to recommendations as they are related to follow-up/advice */}
                            {categorizedFields.care.length > 0 && (
                                <Card className="border border-orange-500/20 bg-orange-500/5 shadow-sm">
                                    <div className="p-4 space-y-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-md bg-orange-500/10">
                                                <ClipboardList className="w-4 h-4 text-orange-600" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-base font-semibold text-foreground">Care Instructions</h3>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Dietary advice, follow-up, and discharge instructions
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid gap-3">
                                            {categorizedFields.care.map((field, index) => (
                                                <div key={index} className="p-3 rounded-md bg-background border border-border/50 space-y-1">
                                                    <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">{field.label}</p>
                                                    <p className="text-foreground leading-relaxed text-pretty whitespace-pre-wrap">
                                                        {renderFieldValue(field.value)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </>
                    ) : (
                        <Card className="border border-border/50">
                            <div className="p-6 text-center">
                                <Heart className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                                <p className="text-muted-foreground">No health recommendations available for this document.</p>
                            </div>
                        </Card>
                    )}
                </TabsContent>
                <TabsContent value="raw">
                    <Card className="border border-border/50">
                        <div className="p-4">
                            <pre className="text-xs text-foreground overflow-x-auto bg-muted/30 p-3 rounded-md">
                                {JSON.stringify(structuredData, null, 2)}
                            </pre>
                        </div>
                    </Card>
                    {/* Bind billing and other fields to raw as they are miscellaneous */}
                    {categorizedFields.billing.length > 0 && (
                        <Card className="border border-emerald-500/20 bg-emerald-500/5 shadow-sm">
                            <div className="p-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-emerald-500/10">
                                        <DollarSign className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-semibold text-foreground">Billing & Pricing</h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Cost breakdown, charges, and payment information for claims processing
                                        </p>
                                    </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {categorizedFields.billing.map((field, index) => (
                                        <div key={index} className="p-3 rounded-md bg-background border border-border/50 space-y-1">
                                            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">{field.label}</p>
                                            <p className="text-foreground leading-relaxed text-pretty font-semibold whitespace-pre-wrap">
                                                {renderFieldValue(field.value)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    )}
                    {categorizedFields.other.length > 0 && (
                        <Card className="border border-amber-500/20 bg-amber-500/5 shadow-sm">
                            <div className="p-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-amber-500/10">
                                        <FileJson className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-semibold text-foreground">Custom & Uncategorized Fields</h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Additional fields that don't fit standard medical categories - displayed in structured format
                                        </p>
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    {categorizedFields.other.map((field, index) => (
                                        <div
                                            key={index}
                                            className="p-3 rounded-md bg-background border border-amber-500/20 hover:border-amber-500/30 transition-colors space-y-1"
                                        >
                                            <div className="flex items-start gap-1">
                                                <code className="text-xs font-mono font-semibold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                                    {field.label}
                                                </code>
                                            </div>
                                            <p className="text-foreground leading-relaxed text-pretty font-mono text-sm pl-2 border-l-2 border-amber-500/30 whitespace-pre-wrap">
                                                {renderFieldValue(field.value)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
            {/* Document Summary - Moved to end if available, as it's general */}
            {document?.structuredData?.summary && (
                <Card className="border border-border/50 shadow-sm">
                    <div className="p-4 space-y-3">
                        <h3 className="text-base font-semibold text-foreground">Summary</h3>
                        <div className="space-y-2">
                            {document.structuredData.summary
                                .split("\n")
                                .filter((line: string) => line.trim())
                                .map((paragraph: string, index: number) => (
                                    <p key={index} className="text-foreground leading-relaxed text-pretty">
                                        {paragraph.trim()}
                                    </p>
                                ))}
                        </div>
                    </div>
                </Card>
            )}
            <div className="flex flex-wrap gap-2">
                {/* Use router.push */}
                {/*<Button onClick={() => router.push("/")} variant="outline" className="gap-1 bg-transparent">*/}
                {/*    <ArrowLeft className="w-3 h-3" />*/}
                {/*    <span className="hidden sm:inline">Upload Another</span>*/}
                {/*</Button>*/}
                {/*<Link href="/search">*/}
                {/*    <Button variant="outline" className="gap-1 bg-transparent">*/}
                {/*        <Search className="w-3 h-3" />*/}
                {/*        <span className="hidden sm:inline">Search Records</span>*/}
                {/*    </Button>*/}
                {/*</Link>*/}
                {/* Optional chaining for fileUrl */}
                {document?.fileUrl && (
                    <a href={document.fileUrl} target="_blank" rel="noopener noreferrer" download={cleanDownloadFilename}>
                        <Button variant="outline" className="gap-1 bg-transparent">
                            <Download className="w-3 h-3" />
                            <span className="hidden sm:inline">Download Original</span>
                        </Button>
                    </a>
                )}
                {/* Optional chaining for structuredData */}
                {document?.structuredData && (
                    <Button onClick={handleDownloadJSON} variant="outline" className="gap-1 bg-transparent">
                        <FileJson className="w-3 h-3" />
                        <span className="hidden sm:inline">Download JSON</span>
                    </Button>
                )}
            </div>
        </div>
    )
}