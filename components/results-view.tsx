"use client"
import { useEffect, useState, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
// Add this import with the other icon imports
import { ClipboardCheck, Shield } from "lucide-react"
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
import * as XLSX from "xlsx"
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
    fraudDetection?: any
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
// Add this helper function before the main component
// Update the shouldExcludeField function with better lab result matching
function shouldExcludeField(label: string, structuredData: any): boolean {
    const labelLower = label.toLowerCase()
    // Skip fields that are already displayed in the main section
    const skipLabels = [
        'patient name',
        'name',
        'full name',
        'date of birth',
        'dob',
        'age',
        'gender',
        'sex',
        'medical record number',
        'mrn',
        'mr number',
        'hospital name',
        'facility',
        'department',
        'doctor name',
        'clinician name',
        'consultant'
    ]
    // Check basic skip labels
    if (skipLabels.some(skip => labelLower.includes(skip))) {
        return true
    }
    // Skip if this field data already exists in structured sections
    // Check clinical data
    if (structuredData?.clinicalData) {
        const clinicalData = structuredData.clinicalData
        // Check if it's a diagnosis (already shown in Clinical tab)
        if (clinicalData.diagnosis && labelLower.includes('diagnosis')) {
            return true
        }
        // Check if it's in secondary diagnoses
        if (clinicalData.secondaryDiagnoses?.some((d: string) =>
            labelLower.includes(d.toLowerCase()))) {
            return true
        }
        // Check if it's a lab result (already shown in Laboratory Results)
        // More robust matching - check if any part of the label matches a test name
        if (clinicalData.labResults?.length > 0) {
            for (const result of clinicalData.labResults) {
                const testName = result.test?.toLowerCase() || ''
                if (testName && labelLower.includes(testName)) {
                    return true
                }
                // Also check if the label starts with or contains the test name
                if (testName && (labelLower.startsWith(testName) || labelLower.split(/[\s:,\-]/)[0].includes(testName.split(/[\s:,\-]/)[0]))) {
                    return true
                }
            }
        }
        // Check if it's a medication (already shown in Medications section)
        if (clinicalData.medications?.length > 0) {
            for (const med of clinicalData.medications) {
                const medName = med.name?.toLowerCase() || ''
                if (medName && (labelLower.includes(medName) || labelLower.startsWith(medName))) {
                    return true
                }
            }
        }
        // Check vital signs - be more strict, check exact matches only
        if (clinicalData.vitalSigns) {
            const vitalSignKeys = Object.keys(clinicalData.vitalSigns).map(k => k.toLowerCase())
            // Check if label matches vital sign keywords exactly or as prefix
            const vitalKeywords = ['blood pressure', 'heart rate', 'pulse', 'temperature', 'spo2', 'oxygen saturation', 'respiratory rate', 'weight', 'height', 'bmi']
            if (vitalKeywords.some(vital => labelLower.includes(vital))) {
                return true
            }
        }
    }
    // Check document info
    if (structuredData?.documentInfo) {
        if (structuredData.documentInfo.reportDate && (labelLower.includes('report date') || labelLower.includes('date of report'))) {
            return true
        }
        if (structuredData.documentInfo.type && labelLower.includes('document type')) {
            return true
        }
    }
    // Check provider info
    if (structuredData?.providerInfo) {
        if (structuredData.providerInfo.hospitalName && labelLower.includes('hospital')) {
            return true
        }
        if (structuredData.providerInfo.department && labelLower.includes('department')) {
            return true
        }
        if (structuredData.providerInfo.doctorName && (labelLower.includes('doctor') || labelLower.includes('physician') || labelLower.includes('consultant'))) {
            return true
        }
    }
    // Check patient info
    if (structuredData?.patientInfo) {
        if (structuredData.patientInfo.dateOfBirth && (labelLower.includes('date of birth') || labelLower.includes('dob'))) {
            return true
        }
        if (structuredData.patientInfo.age && labelLower.includes('age')) {
            return true
        }
        if (structuredData.patientInfo.gender && (labelLower.includes('gender') || labelLower.includes('sex'))) {
            return true
        }
    }
    return false
}
// Update the categorizeFields function to accept structuredData as parameter
function categorizeFields(fields: Array<any>, structuredData: any = {}) {
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
        // Skip fields that are already shown in structured data
        if (shouldExcludeField(normalizedField.label, structuredData)) {
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
    const [isLoading, setIsLoading] = useState(!initialDocument)
    const [error, setError] = useState<string | null>(null)
    const [selectedLanguage, setSelectedLanguage] = useState<string>("en")
    const [translatedContent, setTranslatedContent] = useState<any>(null)
    const [translatedRecommendations, setTranslatedRecommendations] = useState<any>(null)
    const [isTranslating, setIsTranslating] = useState(false)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
    const [showRecommendations, setShowRecommendations] = useState(true)

    // Track if we've already initiated fetch for this ID to prevent duplicates
    const fetchInitiatedRef = useRef(false)
    const currentIdRef = useRef<string | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    useEffect(() => {
        // If initialDocument is provided, use it and don't fetch
        if (initialDocument) {
            setDocument(initialDocument)
            setIsLoading(false)
            setError(null)
            fetchInitiatedRef.current = true
            return
        }

        const documentId = searchParams?.get("id")

        // If no ID, set error and return
        if (!documentId) {
            setError("No document ID provided")
            setIsLoading(false)
            return
        }

        // If we already fetched this exact ID, skip to prevent duplicate fetch
        if (fetchInitiatedRef.current && currentIdRef.current === documentId) {
            console.log(`[ResultsView] Skipping duplicate fetch for ID: ${documentId}`)
            return
        }

        // Mark this ID as being fetched
        currentIdRef.current = documentId
        fetchInitiatedRef.current = true

        // Abort any previous requests
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }

        // Create new abort controller for this fetch
        abortControllerRef.current = new AbortController()
        const abortController = abortControllerRef.current

        const fetchDocument = async () => {
            try {
                setIsLoading(true)
                setError(null)

                console.log(`[ResultsView] Fetching document: ${documentId}`)
                
                const response = await fetch(`/api/parse-document?id=${documentId}`, {
                    signal: abortController.signal
                })

                if (!response.ok) {
                    throw new Error("Failed to fetch record")
                }

                const data = await response.json()
                console.log("[ResultsView] Document data loaded successfully:", data)
                setDocument(data)
            } catch (err) {
                if (err instanceof Error && err.name === "AbortError") {
                    console.log(`[ResultsView] Fetch aborted for ID: ${documentId}`)
                    return
                }
                console.error("[ResultsView] Fetch error:", err)
                setError("Failed to load record")
            } finally {
                setIsLoading(false)
            }
        }

        fetchDocument()

        // Cleanup function
        return () => {
            if (abortController) {
                abortController.abort()
            }
        }
    }, [searchParams?.get("id"), initialDocument])

    const handleLanguageChange = async (language: string) => {
        // Stop any playing audio when language changes
        if (currentAudio) {
            currentAudio.pause()
            setIsSpeaking(false)
            setCurrentAudio(null)
        }
        setSelectedLanguage(language)
        if (language === "en") {
            setTranslatedContent(null)
            setTranslatedRecommendations(null)
            return
        }
        if (!document?.healthRecommendations) {
            console.log("[ResultsView] No health recommendations to translate")
            return
        }
        setIsTranslating(true)
        try {
            console.log("[ResultsView] Starting translation to:", language)
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
                console.error("[ResultsView] Translation API error:", response.status, errorText)
                throw new Error(`Translation failed: ${response.status} - ${errorText}`)
            }
            const data = await response.json()
            console.log("[ResultsView] Translation successful")
            setTranslatedRecommendations(data.translatedRecommendations)
        } catch (error) {
            console.error("[ResultsView] Translation error:", error)
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
            console.log("[ResultsView] Using Web Speech API for language:", langCode)
            if (!window.speechSynthesis) {
                throw new Error("Speech synthesis not supported in this browser")
            }
            window.speechSynthesis.cancel()
            const utterance = new SpeechSynthesisUtterance(textToRead)
            utterance.lang = langCode
            utterance.rate = 0.9
            utterance.pitch = 1.0
            utterance.volume = 1.0
            const voices = window.speechSynthesis.getVoices()
            const preferredVoice = voices.find((voice) => voice.lang === langCode || voice.lang.startsWith(selectedLanguage))
            if (preferredVoice) {
                utterance.voice = preferredVoice
                console.log("[ResultsView] Using voice:", preferredVoice.name)
            } else {
                console.log("[ResultsView] No specific voice found for", langCode, "using default")
            }
            utterance.onend = () => {
                console.log("[ResultsView] Speech synthesis ended")
                setIsSpeaking(false)
            }
            utterance.onerror = (event) => {
                console.error("[ResultsView] Speech synthesis error:", event.error)
                setIsSpeaking(false)
                alert(`Speech failed: ${event.error}`)
            }
            window.speechSynthesis.speak(utterance)
        } catch (error: any) {
            console.error("[ResultsView] Text-to-speech error:", error)
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
        if (selectedLanguage !== "en" && translatedRecommendations) {
            return translatedRecommendations
        }
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
    const categorizedFields = categorizeFields(document?.fields || [], document?.structuredData || {})

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
    const splitDoctors = (doctorText: any): string[] => {
        // Case 1: Already an array
        if (Array.isArray(doctorText)) {
            return doctorText
                .map(item => {
                    if (typeof item === "string") {
                        return item.trim();
                    }
                    if (typeof item === "object" && item !== null) {
                        // Try multiple property names to find the doctor name
                        const name = item.name || item.doctorName || item.fullName || item.displayName || item.reg_no || "";
                        return String(name).trim();
                    }
                    return "";
                })
                .filter(Boolean); // Remove empty strings
        }
        // Case 2: Not a string
        if (typeof doctorText !== "string") {
            return [];
        }
        // Case 3: String with multiple doctors
        return doctorText
            .replace(/Dr\./g, "|Dr.")
            .split("|")
            .map(d => d.trim())
            .filter(Boolean);
    };
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
    // Add this helper function before the main component, after renderFieldValue
    const renderFraudDetectionMatches = (matches: any[], testType: string) => {
        if (!Array.isArray(matches) || matches.length === 0) {
            return null;
        }

        const colorScheme = testType === 'ecg' 
            ? { border: 'border-blue-500/20', bg: 'bg-blue-500/5', accent: 'text-blue-600' }
            : { border: 'border-purple-500/20', bg: 'bg-purple-500/5', accent: 'text-purple-600' };

        return (
            <div className="space-y-2 mt-2">
                <p className={`text-sm font-semibold ${colorScheme.accent}`}>Matched Test Results ({matches.length})</p>
                <div className="space-y-2">
                    {matches.map((match: any, matchIdx: number) => (
                        <div key={matchIdx} className={`p-3 rounded-lg border ${colorScheme.border} ${colorScheme.bg} space-y-2`}>
                            <div className="grid gap-2 text-xs">
                                {match.patient_name && (
                                    <div className="flex justify-between items-start">
                                        <span className="text-muted-foreground font-semibold">Patient:</span>
                                        <span className="text-foreground font-medium">{match.patient_name}</span>
                                    </div>
                                )}
                                {match.matched_tests !== undefined && (
                                    <div className="flex justify-between items-start">
                                        <span className="text-muted-foreground font-semibold">Matched:</span>
                                        <span className="text-foreground font-medium">{match.matched_tests}/{match.total_tests}</span>
                                    </div>
                                )}
                                {match.match_percentage !== undefined && (
                                    <div className="flex justify-between items-start">
                                        <span className="text-muted-foreground font-semibold">Match %:</span>
                                        <span className={`font-bold ${match.match_percentage === 100 ? 'text-red-600' : 'text-orange-600'}`}>
                                            {match.match_percentage}%
                                        </span>
                                    </div>
                                )}
                                {match.job_id && (
                                    <div className="flex justify-between items-start">
                                        <span className="text-muted-foreground font-semibold">Job ID:</span>
                                        <span className="text-foreground font-mono text-xs truncate">{match.job_id}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
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
                <Button
                    onClick={() => router.push("/")}

                    variant="outline"
                    className="gap-2 hover:bg-transparent hover:text-inherit active:bg-transparent"
                >
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
                <Button onClick={() => router.push("/")} variant="outline" className="gap-2 hover:bg-transparent hover:text-inherit active:bg-transparent">
                    <ArrowLeft className="w-4 h-4" />
                    Go Back
                </Button>
            </div>
        )
    }
    const displayRecommendations = getDisplayRecommendations()
    const handleDownload = () => {
        if (typeof document === "undefined" || !document?.structuredData) return;
        const wb = XLSX.utils.book_new();

        // Helper to flatten nested objects into key-value pairs
        const flattenObject = (obj: any, prefix = ""): Array<[string, string]> => {
            const result: Array<[string, string]> = [];

            Object.entries(obj).forEach(([key, value]: [string, any]) => {
                const fullKey = prefix ? `${prefix} - ${key}` : key;

                if (value === null || value === undefined) {
                    result.push([fullKey, "N/A"]);
                } else if (Array.isArray(value)) {
                    if (value.length === 0) {
                        result.push([fullKey, "N/A"]);
                    } else if (typeof value[0] === "object" && value[0] !== null) {
                        // For array of objects, stringify nicely
                        result.push([fullKey, JSON.stringify(value, null, 2)]);
                    } else {
                        // For simple arrays, join with comma
                        result.push([fullKey, value.map(v => String(v)).join(", ")]);
                    }
                } else if (typeof value === "object" && value !== null) {
                    // Recursively flatten nested objects (null check redundant here due to earlier check, but explicit for clarity)
                    const flattened = flattenObject(value, fullKey);
                    result.push(...flattened);
                } else {
                    result.push([fullKey, String(value)]);
                }
            });

            return result;
        };
        // Create Raw Data sheet from rawParsedData
        if (document.structuredData?.rawParsedData) {
            const rawData = flattenObject(document.structuredData.rawParsedData);
            const sheetData: any[][] = [["Field", "Value"]];

            rawData.forEach(([field, value]) => {
                sheetData.push([field, value]);
            });

            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            ws['!cols'] = [{ wch: 35 }, { wch: 60 }];
            XLSX.utils.book_append_sheet(wb, ws, "Raw Data");
        }

        // Write the Excel file
        XLSX.writeFile(wb, `${document.fileName.replace(/\.[^/.]+$/, "")}_raw_data_${new Date().toISOString().split('T')[0]}.xlsx`);
    };
    const handleShare = async () => {
        const shareData = {
            title: `Medical Record - ${patientName}`,
            text: `Parsed medical document for ${patientName}`,
            url: window.location.href,
        }
        if (navigator.share) {
            try {
                await navigator.share(shareData)
                return
            } catch (err) {
                console.log("Web Share cancelled or failed:", err)
            }
        }
        // Fallback: copy link to clipboard
        try {
            const textArea = document.createElement("textarea")
            textArea.value = window.location.href
            textArea.style.position = "fixed"
            textArea.style.left = "-999999px"
            textArea.style.top = "0"
            textArea.style.opacity = "0"
            document.body.appendChild(textArea)
            textArea.focus()
            textArea.select()
            const successful = document.execCommand("copy")
            document.body.removeChild(textArea)
            if (successful) {
                alert("Link copied to clipboard!")
            } else {
                alert("Failed to copy link. Please try again.")
            }
        } catch (err) {
            console.error("Failed to copy link:", err)
            alert("Failed to copy link. Please try again.")
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
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {structuredData?.documentInfo?.reportDate?.report_date || // Access a key, e.g., report_date
                                        structuredData?.documentInfo?.reportDate?.request_date || // Fallback to another key
                                        JSON.stringify(structuredData?.documentInfo?.reportDate) || // Or stringify the whole object
                                        "Date not available"}
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
                    <TabsTrigger value="medical-history">Medical History</TabsTrigger>
                    {/*<TabsTrigger value="recommendations">Recommendations</TabsTrigger>*/}
                    <TabsTrigger value="fraud-detection">Fraud Detection</TabsTrigger>
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
                                {/* Header */}
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center">
                                        <Building2 className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <h3 className="font-semibold text-foreground">Healthcare Provider</h3>
                                </div>
                                {/* Content */}
                                <div className="space-y-2">
                                    {/* Hospital */}
                                    {structuredData?.providerInfo?.hospitalName && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">Hospital / Clinic</p>
                                            <p className="text-sm font-medium text-foreground">
                                                {structuredData.providerInfo.hospitalName}
                                            </p>
                                        </div>
                                    )}
                                    {/* Department */}
                                    {structuredData?.providerInfo?.department && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">Department</p>
                                            <p className="text-sm font-medium text-foreground">
                                                {structuredData.providerInfo.department}
                                            </p>
                                        </div>
                                    )}
                                    {/* Doctors (one by one) */}
                                    {structuredData?.providerInfo?.doctorName && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">Doctor(s)</p>
                                            <div className="space-y-1">
                                                {splitDoctors(structuredData.providerInfo.doctorName).map(
                                                    (doctor, index) => (
                                                        <p
                                                            key={index}
                                                            className="text-sm font-medium text-foreground"
                                                        >
                                                            {doctor.trim()}
                                                        </p>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {/* Additional Hospital Details */}
                                    {categorizedFields.hospital.length > 0 && (
                                        <div className="space-y-2 mt-3 pt-3 border-t border-border/50">
                                            <p className="text-xs font-semibold text-muted-foreground">
                                                Additional Details
                                            </p>
                                            {categorizedFields.hospital.map((field, index) => (
                                                <div key={index} className="space-y-1">
                                                    <p className="text-xs text-muted-foreground">
                                                        {field.label}
                                                    </p>
                                                    <p className="text-sm font-medium text-foreground">
                                                        {renderFieldValue(field.value)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>
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
                    {structuredData?.clinicalData?.medications && Array.isArray(structuredData.clinicalData.medications) && structuredData.clinicalData.medications.length > 0 && (
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
                                            <p className="text-sm font-semibold text-foreground">{med?.name || "Unknown Medication"}</p>
                                            <div className="mt-1 grid grid-cols-3 gap-1 text-xs">
                                                {med?.dosage && (
                                                    <div>
                                                        <span className="text-muted-foreground">Dosage:</span>
                                                        <p className="font-medium text-foreground">{med.dosage}</p>
                                                    </div>
                                                )}
                                                {med?.frequency && (
                                                    <div>
                                                        <span className="text-muted-foreground">Frequency:</span>
                                                        <p className="font-medium text-foreground">{med.frequency}</p>
                                                    </div>
                                                )}
                                                {med?.duration && (
                                                    <div>
                                                        <span className="text-muted-foreground">Duration:</span>
                                                        <p className="font-medium text-foreground">{med.duration}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {structuredData.clinicalData.medications.length > 3 && ( // Show "See more" only if there are more than 3 medications
                                        <div className="text-center">
                                            <Button
                                                variant="link"
                                                onClick={() => {
                                                    const allMedications = document?.structuredData?.clinicalData?.medications || [];
                                                    setDocument((prev: any) => ({
                                                        ...prev,
                                                        clinicalData: {
                                                            ...prev.clinicalData,
                                                            medications: allMedications,
                                                        },
                                                    }));
                                                }}
                                                className="text-sm font-medium text-primary"
                                            >
                                                See more medications ({structuredData.clinicalData.medications.length - 3} more)
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    )}
                    {/* Vital Signs */}
                    {/*{structuredData?.clinicalData?.vitalSigns &&*/}

                    {/*    Object.values(structuredData.clinicalData.vitalSigns).some((v) => v !== null) && (*/}

                    {/*        <Card className="border border-border/50">*/}

                    {/*            <div className="p-4 space-y-3">*/}

                    {/*                <div className="flex items-center gap-1">*/}

                    {/*                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">*/}

                    {/*                        <Activity className="w-3 h-3 text-primary" />*/}

                    {/*                    </div>*/}

                    {/*                    <h3 className="font-semibold text-foreground">Vital Signs</h3>*/}

                    {/*                </div>*/}

                    {/*                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">*/}

                    {/*                    {Object.entries(structuredData.clinicalData.vitalSigns).map(*/}

                    {/*                        ([key, value]: [string, any]) =>*/}

                    {/*                            value && (*/}

                    {/*                                <div key={key} className="space-y-1">*/}

                    {/*                                    <p className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</p>*/}

                    {/*                                    <p className="text-sm font-semibold text-foreground">{value}</p>*/}

                    {/*                                </div>*/}

                    {/*                            ),*/}

                    {/*                    )}*/}

                    {/*                </div>*/}

                    {/*            </div>*/}

                    {/*        </Card>*/}

                    {/*    )}*/}
                    {/* Procedures */}
                    {structuredData?.clinicalData?.procedures && Array.isArray(structuredData.clinicalData.procedures) && structuredData.clinicalData.procedures.length > 0 && (
                        <Card className="border border-blue-500/20 bg-blue-500/5 shadow-sm">
                            <div className="p-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-blue-500/10">
                                        <Stethoscope className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-semibold text-foreground">Procedures</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Tests and procedures performed</p>
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    {structuredData.clinicalData.procedures.map((procedure: any, index: number) => (
                                        <div
                                            key={index}
                                            className="flex items-start gap-3 p-3 rounded-md bg-background border border-blue-500/20 hover:border-blue-500/40 transition-colors"
                                        >
                                            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-foreground">
                                                    {procedure.procedure_name || procedure.name || (typeof procedure === "string" ? procedure : JSON.stringify(procedure))}
                                                </p>
                                                {procedure.date && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Date: {procedure.date}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    )}
                    {/* Imaging Findings */}
                    {structuredData?.clinicalData?.imagingFindings && (typeof structuredData.clinicalData.imagingFindings === "object" ? Object.keys(structuredData.clinicalData.imagingFindings).length > 0 : structuredData.clinicalData.imagingFindings) && (
                        <Card className="border border-pink-500/20 bg-pink-500/5 shadow-sm">
                            <div className="p-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-pink-500/10">
                                        <TestTube className="w-4 h-4 text-pink-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-semibold text-foreground">Imaging Findings</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Radiological and imaging findings</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {typeof structuredData.clinicalData.imagingFindings === "object" && structuredData.clinicalData.imagingFindings !== null ? (
                                        Array.isArray(structuredData.clinicalData.imagingFindings) ? (
                                            // Handle array of examinations
                                            structuredData.clinicalData.imagingFindings.map((exam: any, examIndex: number) => (
                                                <div key={examIndex} className="p-3 rounded-md bg-background border border-pink-500/20 space-y-3">
                                                    {exam.examination_name && (
                                                        <h4 className="text-sm font-semibold text-pink-600 uppercase tracking-wide">{exam.examination_name}</h4>
                                                    )}
                                                    {Array.isArray(exam.tests) && exam.tests.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {exam.tests.map((test: any, testIndex: number) => (
                                                                <div
                                                                    key={testIndex}
                                                                    className="rounded-lg border border-pink-300/30 bg-pink-50/40 px-4 py-3 space-y-3"
                                                                >
                                                                    {/* TEST NAME */}
                                                                    {(test.test_name || test.testName) && (
                                                                        <div className="space-y-1">
                                                                            <span className="text-xs font-semibold text-muted-foreground uppercase">
                                                                                Test Name:
                                                                            </span>
                                                                            <p className="text-sm font-semibold text-foreground">
                                                                                {test.test_name || test.testName}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                    {/* RESULT */}
                                                                    {test.result && (
                                                                        <div className="space-y-1">
                                                                            <span className="text-xs font-semibold text-muted-foreground uppercase">
                                                                                Result:
                                                                            </span>
                                                                            <p className="text-sm text-foreground leading-relaxed">
                                                                                {test.result}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}

                                                            {exam.tests.length > 3 && ( // Show "See more" button if there are more than 3 tests
                                                                <div className="text-center">
                                                                    <Button
                                                                        variant="link"
                                                                        onClick={() => {
                                                                            const allTests = exam.tests || [];
                                                                            // Find the parent of 'tests' array to update state correctly
                                                                            setDocument((prev: any) => {
                                                                                const cloned = { ...prev };
                                                                                const examToUpdate = cloned.structuredData?.clinicalData?.imagingFindings?.find((e: any) => e.examination_name === exam.examination_name);
                                                                                if (examToUpdate) {
                                                                                    examToUpdate.tests = allTests;
                                                                                }
                                                                                return cloned;
                                                                            });
                                                                        }}
                                                                        className="text-sm font-medium text-primary"
                                                                    >
                                                                        See more tests ({exam.tests.length - 3} more)
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground">No test results available</p>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            // Handle object format (backwards compatibility)
                                            Object.entries(structuredData.clinicalData.imagingFindings).map(([key, value]: [string, any], index: number) => (
                                                <div key={index} className="p-3 rounded-md bg-background border border-pink-500/20 space-y-2">
                                                    <p className="text-xs font-semibold text-pink-600 uppercase tracking-wide">{key.replace(/([A-Z])/g, " $1")}</p>
                                                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                                        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
                                                    </p>
                                                </div>
                                            ))
                                        )
                                    ) : (
                                        <div className="p-3 rounded-md bg-background border border-pink-500/20">
                                            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                                {String(structuredData.clinicalData.imagingFindings)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    )}
                    {/* Photo Comparison */}
                    {structuredData?.photoComparison && Object.keys(structuredData.photoComparison).length > 0 && (
                        <Card className="border border-indigo-500/20 bg-indigo-500/5 shadow-sm">
                            <div className="p-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-indigo-500/10">
                                        <Eye className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-semibold text-foreground">Photo Comparison Analysis</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Identity verification and image matching results</p>
                                    </div>
                                </div>

                                {/* Confidence Level - Numeric */}
                                {structuredData.photoComparison.confidence !== undefined && (
                                    <div className="p-3 rounded-md bg-background border border-indigo-500/20 space-y-2">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Confidence Level</p>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                                                {(() => {
                                                    const confidence = structuredData.photoComparison.confidence;
                                                    let bgColor = "bg-red-500";
                                                    let widthClass = "w-1/3";

                                                    if (typeof confidence === 'number') {
                                                        if (confidence >= 80) {
                                                            bgColor = "bg-green-500";
                                                            widthClass = "w-full";
                                                        } else if (confidence >= 50) {
                                                            bgColor = "bg-yellow-500";
                                                            widthClass = "w-2/3";
                                                        }
                                                    }

                                                    return <div className={`h-full transition-all ${bgColor} ${widthClass}`} />;
                                                })()}
                                            </div>
                                            <Badge
                                                variant={
                                                    (typeof structuredData.photoComparison.confidence === 'number' && structuredData.photoComparison.confidence >= 80)
                                                        ? "default"
                                                        : (typeof structuredData.photoComparison.confidence === 'number' && structuredData.photoComparison.confidence >= 50)
                                                            ? "secondary"
                                                            : "destructive"
                                                }
                                            >
                                                {typeof structuredData.photoComparison.confidence === 'number'
                                                    ? `${structuredData.photoComparison.confidence}%`
                                                    : structuredData.photoComparison.confidence}
                                            </Badge>
                                        </div>
                                    </div>
                                )}

                                {/* Similarity Score */}
                                {structuredData.photoComparison.similarity !== undefined && (
                                    <div className="p-3 rounded-md bg-background border border-indigo-500/20 space-y-2">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Similarity Score</p>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                                                {(() => {
                                                    const similarity = structuredData.photoComparison.similarity;
                                                    let bgColor = "bg-red-500";
                                                    let widthClass = "w-1/3";

                                                    if (typeof similarity === 'number') {
                                                        if (similarity >= 0.8) {
                                                            bgColor = "bg-green-500";
                                                            widthClass = "w-full";
                                                        } else if (similarity >= 0.5) {
                                                            bgColor = "bg-yellow-500";
                                                            widthClass = "w-2/3";
                                                        }
                                                    }

                                                    return <div className={`h-full transition-all ${bgColor} ${widthClass}`} />;
                                                })()}
                                            </div>
                                            <Badge
                                                variant={
                                                    (typeof structuredData.photoComparison.similarity === 'number' && structuredData.photoComparison.similarity >= 0.8)
                                                        ? "default"
                                                        : (typeof structuredData.photoComparison.similarity === 'number' && structuredData.photoComparison.similarity >= 0.5)
                                                            ? "secondary"
                                                            : "destructive"
                                                }
                                            >
                                                {typeof structuredData.photoComparison.similarity === 'number'
                                                    ? `${(structuredData.photoComparison.similarity * 100).toFixed(1)}%`
                                                    : structuredData.photoComparison.similarity}
                                            </Badge>
                                        </div>
                                    </div>
                                )}

                                {/* Image Quality Metrics */}
                                <div className="grid grid-cols-2 gap-3">
                                    {structuredData.photoComparison.quality_image1 !== undefined && (
                                        <div className="p-3 rounded-md bg-background border border-indigo-500/20 space-y-2">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Image 1 Quality</p>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500 transition-all"
                                                        style={{
                                                            width: `${Math.min(structuredData.photoComparison.quality_image1, 100)}%`
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-sm font-semibold text-foreground min-w-[45px]">
                                                    {structuredData.photoComparison.quality_image1}%


                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {structuredData.photoComparison.quality_image2 !== undefined && (
                                        <div className="p-3 rounded-md bg-background border border-indigo-500/20 space-y-2">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Image 2 Quality</p>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500 transition-all"
                                                        style={{
                                                            width: `${Math.min(structuredData.photoComparison.quality_image2, 100)}%`
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-sm font-semibold text-foreground min-w-[45px]">
                                                    {structuredData.photoComparison.quality_image2}%


                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Threshold Used */}
                                {structuredData.photoComparison.threshold_used !== undefined && (
                                    <div className="p-3 rounded-md bg-background border border-indigo-500/20 space-y-2">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Threshold Used</p>
                                        <p className="text-sm font-semibold text-foreground">
                                            {typeof structuredData.photoComparison.threshold_used === 'number'
                                                ? structuredData.photoComparison.threshold_used.toFixed(2)
                                                : structuredData.photoComparison.threshold_used}
                                        </p>
                                    </div>
                                )}

                                {/* Reason/Details */}
                                {structuredData.photoComparison.reason && structuredData.photoComparison.reason.trim() !== "" && (
                                    <div className="p-3 rounded-md bg-background border border-indigo-500/20 space-y-2">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Analysis Details</p>
                                        <p className="text-sm text-foreground leading-relaxed">
                                            {structuredData.photoComparison.reason}
                                        </p>
                                    </div>
                                )}

                                {/* Images Found */}
                                {structuredData.photoComparison.images_found && Array.isArray(structuredData.photoComparison.images_found) && structuredData.photoComparison.images_found.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Images Analyzed</p>
                                        <div className="grid gap-2">
                                            {structuredData.photoComparison.images_found.map((image: any, index: number) => (
                                                <div key={index} className="p-3 rounded-md bg-background border border-indigo-500/20 space-y-2">
                                                    <div className="flex items-start gap-2">
                                                        <div className="w-8 h-8 rounded-md bg-indigo-500/10 flex items-center justify-center shrink-0">
                                                            <span className="text-xs font-semibold text-indigo-600">{image.image_number}</span>
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <p className="text-xs font-medium text-muted-foreground">Image {image.image_number}</p>
                                                            <p className="text-sm text-foreground leading-relaxed">
                                                                {image.description}
                                                            </p>
                                                            {image.source_file && (
                                                                <p className="text-xs text-muted-foreground">
                                                                    Source: {image.source_file}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {structuredData.photoComparison.images_found.length > 3 && ( // Show "See more" button if there are more than 3 images
                                                <div className="text-center">
                                                    <Button
                                                        variant="link"
                                                        onClick={() => {
                                                            const allImages = structuredData.photoComparison.images_found || [];
                                                            setDocument((prev: any) => ({
                                                                ...prev,
                                                                structuredData: {
                                                                    ...prev.structuredData,
                                                                    photoComparison: {
                                                                        ...prev.structuredData.photoComparison,
                                                                        images_found: allImages,
                                                                    },
                                                                },
                                                            }));
                                                        }}
                                                        className="text-sm font-medium text-primary"
                                                    >
                                                        See more images ({structuredData.photoComparison.images_found.length - 3} more)
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
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
                    {document?.structuredData?.clinicalData?.labResults && document.structuredData.clinicalData.labResults.length > 0 && (
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
                                    {document.structuredData.clinicalData.labResults.map((result: any, index: number) => {
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
                <TabsContent value="medical-history" className="space-y-3">
                    {structuredData?.medicalHistoryQuestions && structuredData.medicalHistoryQuestions.length > 0 ? (
                        <Card className="border border-border/50">
                            <div className="p-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-cyan-500/10">
                                        <ClipboardCheck className="w-4 h-4 text-cyan-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-semibold text-foreground">Medical History Questionnaire</h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Patient medical history responses and clinical assessments
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                    {structuredData.medicalHistoryQuestions.map((item: any, index: number) => {
                                        const getAnswerBadgeVariant = (answer: string) => {
                                            const answerLower = answer?.toLowerCase?.() || ""
                                            if (answerLower === "yes") return "default"
                                            if (answerLower === "no") return "secondary"
                                            return "outline"
                                        }
                                        return (
                                            <div
                                                key={index}
                                                className="p-3 rounded-md bg-background border border-cyan-500/20 hover:border-cyan-500/40 transition-colors space-y-2"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-sm font-medium text-foreground flex-1">
                                                        {item.question}
                                                    </p>
                                                    <Badge variant={getAnswerBadgeVariant(item.answer)}>
                                                        {item.answer}
                                                    </Badge>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <Card className="border border-border/50">
                            <div className="p-6 text-center">
                                <ClipboardCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                                <p className="text-muted-foreground">No medical history questionnaire data available for this document.</p>
                            </div>
                        </Card>
                    )}
                </TabsContent>
                <TabsContent value="fraud-detection" className="space-y-3">
                    {(document?.fraudDetection || document?.structuredData?.fraudDetection) ? (
                        <>
                            {/* Get the fraud detection data from either path */}
                            {(() => {
                                const fraudDetection = document?.fraudDetection || document?.structuredData?.fraudDetection;

                                return (
                                    <>
                                        {/* Fraud Detection Summary Card */}
                                        <Card className="border border-red-500/20 bg-red-500/5 shadow-sm">
                                            <div className="p-4 space-y-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 rounded-md bg-red-500/10">
                                                        <Shield className="w-4 h-4 text-red-600" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="text-base font-semibold text-foreground">Fraud Detection Analysis</h3>
                                                        <p className="text-xs text-muted-foreground mt-1">Document verification and authenticity checks</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>

                                        {/* ECG Analysis Section */}
                                        {/* ECG Analysis Section */}
                                        {fraudDetection.ecg && (
                                            <Card className="border border-blue-500/20 bg-blue-500/5">
                                                <div className="p-4 space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <Activity className="w-4 h-4 text-blue-600" />
                                                        <h4 className="text-base font-semibold text-foreground">ECG Analysis</h4>
                                                    </div>
                                                    <div className="grid gap-2 text-sm">
                                                        {Object.entries(fraudDetection.ecg).map(([key, value]: [string, any], idx: number) => {
                                                            // Handle matches array specially
                                                            if (key === 'matches' && Array.isArray(value)) {
                                                                return (
                                                                    <div key={idx} className="col-span-full">
                                                                        {renderFraudDetectionMatches(value, 'ecg')}
                                                                    </div>
                                                                );
                                                            }

                                                            // Handle other properties normally
                                                            return (
                                                                <div key={idx} className="flex justify-between items-start p-2 bg-background rounded border border-border/50">
                                                                    <span className="text-muted-foreground capitalize font-medium">{key.replace(/_/g, ' ')}:</span>
                                                                    <span className="text-foreground font-medium">
                                                                        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : Array.isArray(value) ? `${value.length} items` : String(value)}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </Card>
                                        )}

                                  
                                        {/* TMT Analysis Section */}
                                        {fraudDetection.tmt && (
                                            <Card className="border border-purple-500/20 bg-purple-500/5">
                                                <div className="p-4 space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <Heart className="w-4 h-4 text-purple-600" />
                                                        <h4 className="text-base font-semibold text-foreground">TMT Analysis</h4>
                                                    </div>
                                                    <div className="grid gap-2 text-sm">
                                                        {Object.entries(fraudDetection.tmt).map(([key, value]: [string, any], idx: number) => {
                                                            // Handle matches array specially
                                                            if (key === 'matches' && Array.isArray(value)) {
                                                                return (
                                                                    <div key={idx} className="col-span-full space-y-2">
                                                                        <p className="text-muted-foreground capitalize font-medium">Matched Tests:</p>
                                                                        <div className="space-y-2">
                                                                            {value.map((match: any, matchIdx: number) => (
                                                                                <div key={matchIdx} className="p-3 bg-background rounded border border-purple-500/20 space-y-2">
                                                                                    <div className="grid gap-2 text-xs">
                                                                                        {match.patient_name && (
                                                                                            <div className="flex justify-between items-start">
                                                                                                <span className="text-muted-foreground font-medium">Patient Name:</span>
                                                                                                <span className="text-foreground font-medium">{match.patient_name}</span>
                                                                                            </div>
                                                                                        )}
                                                                                        {match.matched_tests !== undefined && (
                                                                                            <div className="flex justify-between items-start">
                                                                                                <span className="text-muted-foreground font-medium">Matched Tests:</span>
                                                                                                <span className="text-foreground font-medium">{match.matched_tests}</span>
                                                                                            </div>
                                                                                        )}
                                                                                        {match.total_tests !== undefined && (
                                                                                            <div className="flex justify-between items-start">
                                                                                                <span className="text-muted-foreground font-medium">Total Tests:</span>
                                                                                                <span className="text-foreground font-medium">{match.total_tests}</span>
                                                                                            </div>
                                                                                        )}
                                                                                        {match.match_percentage !== undefined && (
                                                                                            <div className="flex justify-between items-start">
                                                                                                <span className="text-muted-foreground font-medium">Match Percentage:</span>
                                                                                                <span className="text-foreground font-medium text-purple-600">{match.match_percentage}%</span>
                                                                                            </div>
                                                                                        )}
                                                                                        {match.job_id && (
                                                                                            <div className="flex justify-between items-start">
                                                                                                <span className="text-muted-foreground font-medium">Job ID:</span>
                                                                                                <span className="text-foreground font-mono text-xs">{match.job_id}</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            ))}

                                                                            {value.length > 3 && ( // Show "See more" button if there are more than 3 matched tests
                                                                                <div className="text-center">
                                                                                    <Button
                                                                                        variant="link"
                                                                                        onClick={() => {
                                                                                            const allMatches = value || [];
                                                                                            // Find the parent of 'matches' array to update state correctly
                                                                                            setDocument((prev: any) => {
                                                                                                const cloned = { ...prev };
                                                                                                const tmtToUpdate = cloned.structuredData?.fraudDetection?.tmt;
                                                                                                if (tmtToUpdate) {
                                                                                                    tmtToUpdate.matches = allMatches;
                                                                                                }
                                                                                                return cloned;
                                                                                            });
                                                                                        }}
                                                                                        className="text-sm font-medium text-primary"
                                                                                    >
                                                                                        See more matches ({value.length - 3} more)
                                                                                    </Button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }

                                                            // Handle other properties normally
                                                            return (
                                                                <div key={idx} className="flex justify-between items-start p-2 bg-background rounded border border-border/50">
                                                                    <span className="text-muted-foreground capitalize font-medium">{key.replace(/_/g, ' ')}:</span>
                                                                    <span className="text-foreground font-medium">
                                                                        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : Array.isArray(value) ? `${value.length} items` : String(value)}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </Card>
                                        )}
                                    </>
                                );
                            })()}
                        </>
                    ) : (
                        <Card className="border border-border/50">
                            <div className="p-6 text-center">
                                <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                                <p className="text-muted-foreground">No fraud detection data available for this document.</p>
                            </div>
                        </Card>
                    )}
                </TabsContent>
                <TabsContent value="raw">
                    <Card className="border border-border/50">
                        <div className="p-4">
                            <pre className="text-xs text-foreground overflow-x-auto bg-muted/30 p-3 rounded-md">
                                {(() => {
                                    let displayStructured = { ...structuredData };
                                    if (structuredData?.rawParsedData?.lab_results) {
                                        displayStructured.clinicalData = {
                                            ...displayStructured.clinicalData,
                                            labResults: null  // Remove duplicate flattened lab results
                                        };
                                    }
                                    return JSON.stringify(displayStructured, null, 2);
                                })()}
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
                    <Button
                        onClick={handleDownloadJSON}
                        variant="outline"
                        className="gap-1 bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-700"
                    >
                        <FileJson className="w-3 h-3" />
                        <span className="hidden sm:inline">Download JSON</span>
                    </Button>

                )}
            </div>
        </div>
    )
}