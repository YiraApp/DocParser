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

    /**
     * Comprehensive data transformation to match ResultsView expected format.
     * Handles multiple data source formats and creates proper field arrays for categorization.
     */
    const transformDocumentData = (doc: any) => {
        if (!doc) return doc

        // Extract structured data - handle both nested and flat formats
        const raw = doc.structuredData || doc.structured_data || {}

        // Build fields array from structured data for categorization
        const buildFieldsFromStructuredData = (data: any) => {
            const fields: any[] = []

            const flatten = (obj: any, prefix = "") => {
                if (!obj || typeof obj !== "object") return

                Object.entries(obj).forEach(([key, value]) => {
                    if (value === null || value === undefined) return
                    
                    // Skip fraud detection, medical_history_questions as they will be handled separately
                    if (key === "medical_history_questions" || key === "fraudDetection") return

                    const fieldLabel = prefix
                        ? `${prefix} > ${key}`
                        : key.replace(/([A-Z])/g, " $1").trim()

                    if (typeof value === "object" && !Array.isArray(value)) {
                        flatten(value, fieldLabel)
                    } else if (Array.isArray(value)) {
                        fields.push({
                            label: fieldLabel,
                            value: value.map(v =>
                                typeof v === "object" ? JSON.stringify(v) : String(v)
                            ).join(", ")
                        })
                    } else {
                        fields.push({
                            label: fieldLabel,
                            value: String(value)
                        })
                    }
                })
            }

            flatten(data)
            return fields
        }

        const fields = doc.fields || buildFieldsFromStructuredData(raw)

        return {
            id: doc.id || doc.documentId || doc._id,
            fileName: doc.fileName || doc.file_name || "Document",
            fileUrl: doc.fileUrl || doc.file_url,
            uploadedAt: doc.uploadedAt || doc.created_at || doc.uploaded_at || new Date().toISOString(),
            documentType: doc.documentType || doc.document_type || "Medical Document",

            // Categorization-critical fields array
            fields: fields,

            // Build comprehensive structured data object
            structuredData: {
                ...raw,

                // Document metadata
                documentInfo: {
                    type: doc.documentType || doc.document_type || raw.documentInfo?.type || "Medical Document",
                    reportDate: raw.documentInfo?.reportDate ||
                        raw.report_date ||
                        raw.encounter_date ||
                        doc.uploadedAt ||
                        new Date().toISOString(),
                },

                // Patient information - build from multiple sources
                patientInfo: {
                    fullName: raw.patientInfo?.fullName ||
                        raw.patient_name ||
                        "Patient Record",
                    name: raw.patientInfo?.name ||
                        raw.patient_name,
                    dateOfBirth: raw.patientInfo?.dateOfBirth ||
                        raw.date_of_birth,
                    age: raw.patientInfo?.age ||
                        raw.age,
                    gender: raw.patientInfo?.gender ||
                        raw.gender,
                    medicalRecordNumber: raw.patientInfo?.medicalRecordNumber ||
                        raw.patient_id ||
                        raw.mrn,
                    contactNumber: raw.patientInfo?.contactNumber ||
                        raw.contact_number,
                    address: raw.patientInfo?.address ||
                        raw.address,
                },

                // Provider information
                providerInfo: {
                    hospitalName: raw.providerInfo?.hospitalName ||
                        raw.hospital_name ||
                        raw.facility,
                    department: raw.providerInfo?.department ||
                        raw.department,
                    doctorName: raw.providerInfo?.doctorName ||
                        raw.clinician_name ||
                        raw.doctor_name,
                    specialization: raw.providerInfo?.specialization ||
                        raw.specialization,
                },

                // Clinical data
                clinicalData: {
                    diagnosis: raw.clinicalData?.diagnosis ||
                        raw.diagnosis ||
                        "",
                    secondaryDiagnoses: raw.clinicalData?.secondaryDiagnoses ||
                        raw.secondary_diagnoses ||
                        [],
                    medications: raw.clinicalData?.medications ||
                        raw.medications ||
                        [],
                    labResults: raw.clinicalData?.labResults ||
                        raw.lab_results ||
                        [],
                    vitalSigns: raw.clinicalData?.vitalSigns ||
                        raw.vital_signs ||
                        {},
                    procedures: raw.procedures || [],
                    imaging: raw.imaging_findings || raw.imaging || [],
                },

                // Billing information
                billingInfo: {
                    totalAmount: raw.billingInfo?.totalAmount ||
                        raw.total_amount ||
                        raw.total_bill,
                    consultationFee: raw.billingInfo?.consultationFee ||
                        raw.consultation_fee,
                    paymentStatus: raw.billingInfo?.paymentStatus ||
                        raw.payment_status,
                    insuranceClaim: raw.billingInfo?.insuranceClaim ||
                        raw.insurance_claim,
                },

                // Summary and recommendations
                documentSummary: raw.documentSummary ||
                    raw.summary ||
                    raw.document_summary ||
                    "",

                // Medical history questions
                medicalHistoryQuestions: raw.medical_history_questions || [],

                // Fraud detection
                fraudDetection: raw.fraudDetection || raw.fraud_detection || null,

                // Preserve other fields
                ...raw,
            },

            // Health recommendations
            healthRecommendations: doc.healthRecommendations ||
                doc.health_recommendations ||
                raw.recommendations,

            // Confidence score
            confidenceScore: doc.confidenceScore ||
                doc.confidence_score ||
                raw.confidence_score,

            // Summary and notes
            summary: doc.summary || raw.summary || "",
            notes: doc.notes || [],
        }
    }

    const transformedDocument = transformDocumentData(document)

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
                    className="gap-2 hover:bg-transparent hover:text-inherit active:bg-transparent"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Button>
            </div>

            <ResultsView document={transformedDocument} />
        </div>
    )
}