import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"

export async function GET(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get("id")
        if (!id) {
            return NextResponse.json({ error: "Missing document ID" }, { status: 400 })
        }

        // Get session user for authorization
        const sessionUser = await getSessionUser(request)
        if (!sessionUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const db = await getDatabase()
        const documentsCollection = db.collection("documents")
        const jobCollection = db.collection("job_ids")

        // Build query with job_id (string) - works for both documents and job_ids
        const query: any = { job_id: id }
        if (!sessionUser.isAdmin) {
            query.user_email = sessionUser.email
        }

        // First, try documents collection
        let doc = await documentsCollection.findOne(query)

        if (!doc) {
            // Fallback to job_ids collection if not found in documents
            doc = await jobCollection.findOne(query)
            if (!doc) {
                return NextResponse.json({ error: "Document not found or access denied" }, { status: 404 })
            }

            // If from job_ids and has parsed_data, transform it
            if (doc.parsed_data) {
                doc.structured_data = mapParsedDataToStructured(doc.parsed_data)
                doc.fields = extractFieldsFromParsedData(doc.parsed_data)
                doc.summary = buildDocumentSummary(doc.parsed_data)
                doc.status = "completed"
            } else {
                // Partial data fallback
                doc.structured_data = {}
                doc.fields = []
                doc.summary = ""
                doc.status = "processing"
            }
        }

        // Format response to match ParsedDocument interface
        const formattedData = {
            id: doc.job_id,  // Use job_id as id
            fileName: doc.file_name || "Untitled Document",
            fileUrl: doc.file_url || undefined,
            uploadedAt: doc.created_at?.toISOString() || new Date().toISOString(),
            documentType: doc.document_type || "Medical Document",
            fields: doc.fields || [],
            summary: doc.summary || "",
            notes: doc.notes || [],
            structuredData: doc.structured_data || {},
            confidenceScore: doc.confidence_score || undefined,
            healthRecommendations: doc.health_recommendations || undefined,
        }

        return NextResponse.json(formattedData)
    } catch (error) {
        console.error("[PARSE-DOCUMENT] Error:", error)
        return NextResponse.json(
            { error: "Failed to fetch document" },
            { status: 500 }
        )
    }
}

// Helper: Map parsed_data to structured format
function mapParsedDataToStructured(parsedData: any) {
    if (!parsedData) return {}

    const getPatientId = (patientIdField: any): string => {
        if (!patientIdField) return ""
        if (typeof patientIdField === "string") return patientIdField
        if (typeof patientIdField === "object") {
            return patientIdField.mr_no || patientIdField.reg_no || ""
        }
        return String(patientIdField)
    }

    const labResults: { test: any; measuredValue: any; unit: any; referenceRange: any; status: any; notes: null }[] = []
    if (parsedData.lab_results && Array.isArray(parsedData.lab_results)) {
        parsedData.lab_results.forEach((exam: any) => {
            if (exam.tests && Array.isArray(exam.tests)) {
                exam.tests.forEach((test: any) => {
                    labResults.push({
                        test: test.test_name,
                        measuredValue: test.result,
                        unit: test.unit,
                        referenceRange: test.reference_range,
                        status: test.status,
                        notes: null,
                    })
                })
            }
        })
    }

    return {
        patientInfo: {
            fullName: parsedData.patient_name || "",
            dateOfBirth: null,
            age: null,
            gender: null,
            medicalRecordNumber: getPatientId(parsedData.patient_id),
        },
        providerInfo: {
            hospitalName: null,
            department: null,
            doctorName: parsedData.clinician_name || "",
        },
        clinicalData: {
            diagnosis: parsedData.diagnosis || null,
            secondaryDiagnoses: [],
            medications: parsedData.medications || [],
            labResults: labResults,
            vitalSigns: extractVitalSigns(parsedData),
            procedures: parsedData.procedures || null,
            imagingFindings: parsedData.imaging_findings || null,
        },
        documentInfo: {
            type: "Medical Report",
            reportDate: parsedData.encounter_date || null,
        },
        documentSummary: buildDocumentSummary(parsedData),
        // Add medical history questions
        medicalHistoryQuestions: parsedData.medical_history_questions || [],
        // Preserve photo comparison data
        photoComparison: parsedData.photo_comparison || null,
        // Preserve fraud detection data
        fraudDetection: parsedData.fraud_detection || null,
    }
}
// Helper: Extract vital signs
function extractVitalSigns(parsedData: any) {
    const vitalSigns: Record<string, any> = {}
    if (parsedData.lab_results && Array.isArray(parsedData.lab_results)) {
        parsedData.lab_results.forEach((exam: any) => {
            if (exam.examination_name === "Vitals and Body Composition" && exam.tests) {
                exam.tests.forEach((test: any) => {
                    const testName = test.test_name.toLowerCase()
                    if (testName.includes("blood pressure")) {
                        vitalSigns.bloodPressure = test.result
                    } else if (testName.includes("heart rate")) {
                        vitalSigns.heartRate = test.result
                    } else if (testName.includes("temperature")) {
                        vitalSigns.temperature = test.result
                    } else if (testName.includes("oxygen saturation")) {
                        vitalSigns.oxygenSaturation = test.result
                    }
                })
            }
        })
    }
    return vitalSigns
}

// Helper: Build document summary
function buildDocumentSummary(parsedData: any): string {
    const lines: string[] = []
    if (parsedData.patient_name) lines.push(`Patient: ${parsedData.patient_name}`)
    if (parsedData.encounter_date) lines.push(`Encounter Date: ${parsedData.encounter_date}`)
    if (parsedData.clinician_name) lines.push(`Clinician: ${parsedData.clinician_name}`)
    if (parsedData.diagnosis) lines.push(`Diagnosis: ${parsedData.diagnosis}`)
    return lines.join("\n")
}

// Helper: Extract fields for categorization
function extractFieldsFromParsedData(parsedData: any) {
    const fields: Array<{ label: string; value: string }> = []
    if (parsedData.patient_name) {
        fields.push({
            label: "Patient Name",
            value: safeStringify(parsedData.patient_name),
        })
    }
    // Safely handle patient_id as object or string
    if (parsedData.patient_id) {
        if (typeof parsedData.patient_id === "object") {
            if (parsedData.patient_id.mr_no) {
                fields.push({
                    label: "MR Number",
                    value: safeStringify(parsedData.patient_id.mr_no),
                })
            }
            if (parsedData.patient_id.reg_no) {
                fields.push({
                    label: "Registration Number",
                    value: safeStringify(parsedData.patient_id.reg_no),
                })
            }
        } else if (typeof parsedData.patient_id === "string") {
            fields.push({
                label: "Patient ID",
                value: safeStringify(parsedData.patient_id),
            })
        }
    }
    if (parsedData.encounter_date) {
        fields.push({
            label: "Encounter Date",
            value: safeStringify(parsedData.encounter_date),
        })
    }
    if (parsedData.clinician_name) {
        fields.push({
            label: "Clinician Name",
            value: safeStringify(parsedData.clinician_name),
        })
    }
    // Add lab results as fields
    if (parsedData.lab_results && Array.isArray(parsedData.lab_results)) {
        parsedData.lab_results.forEach((exam: any) => {
            if (exam.tests && Array.isArray(exam.tests)) {
                exam.tests.forEach((test: any) => {
                    fields.push({
                        label: `${exam.examination_name} - ${test.test_name}`,
                        value: safeStringify(`${test.result} ${test.unit} (${test.status})`),
                    })
                })
            }
        })
    }
    return fields
}

// Helper: Safely convert any value to string
function safeStringify(value: any): string {
    if (value === null || value === undefined) return ""
    if (typeof value === "string") return value
    if (typeof value === "object") {
        if (Array.isArray(value)) {
            return value.map(v => safeStringify(v)).join(", ")
        }
        // Extract readable value from objects
        if (value.mr_no) return String(value.mr_no)
        if (value.reg_no) return String(value.reg_no)
        if (value.question && value.answer) return `Q: ${value.question}\nA: ${value.answer}`
        return JSON.stringify(value)
    }
    return String(value)
}