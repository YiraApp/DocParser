import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"

// Helper functions
function mapParsedDataToStructured(parsedData: any, fraudDetection: any = null) {
    if (!parsedData) return {}

    const getPatientId = (patientIdField: any): string => {
        if (!patientIdField) return ""
        if (typeof patientIdField === "string") return patientIdField
        if (typeof patientIdField === "object") {
            return patientIdField.mr_no || patientIdField.reg_no || ""
        }
        return String(patientIdField)
    }

    // Ensure medications is always an array
    const medications = Array.isArray(parsedData.medications) ? parsedData.medications : []

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
            medications: medications,
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
        // ✅ FIX: Accept fraud_detection as separate parameter, not from parsedData
        fraudDetection: fraudDetection || parsedData.fraud_detection || null,
    }
}

function extractVitalSigns(parsedData: any) {
    const vitalSigns: Record<string, any> = {}
    if (parsedData.lab_results && Array.isArray(parsedData.lab_results)) {
        parsedData.lab_results.forEach((exam: any) => {
            if (exam.examination_name === "Vitals" && exam.tests) {
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

function buildDocumentSummary(parsedData: any): string {
    const lines: string[] = []
    if (parsedData.patient_name) lines.push(`Patient: ${parsedData.patient_name}`)
    if (parsedData.encounter_date) lines.push(`Encounter Date: ${parsedData.encounter_date}`)
    if (parsedData.clinician_name) lines.push(`Clinician: ${parsedData.clinician_name}`)
    if (parsedData.diagnosis) lines.push(`Diagnosis: ${parsedData.diagnosis}`)
    return lines.join("\n")
}

function extractFieldsFromParsedData(parsedData: any) {
    const fields: Array<{ label: string; value: string }> = []
    const addedFieldLabels = new Set<string>()

    if (parsedData.patient_id) {
        if (typeof parsedData.patient_id === "string") {
            fields.push({
                label: "Patient ID",
                value: safeStringify(parsedData.patient_id),
            })
            addedFieldLabels.add("patient id")
        }
    }

    if (parsedData.encounter_date) {
        fields.push({
            label: "Encounter Date",
            value: safeStringify(parsedData.encounter_date),
        })
        addedFieldLabels.add("encounter date")
    }

    if (parsedData.clinician_name) {
        fields.push({
            label: "Clinician Name",
            value: safeStringify(parsedData.clinician_name),
        })
        addedFieldLabels.add("clinician name")
    }

    if (parsedData.lab_results && Array.isArray(parsedData.lab_results)) {
        parsedData.lab_results.forEach((exam: any) => {
            if (exam.tests && Array.isArray(exam.tests)) {
                exam.tests.forEach((test: any) => {
                    const fieldLabel = `${exam.examination_name} - ${test.test_name}`
                    // Only add if not already added
                    if (!addedFieldLabels.has(fieldLabel.toLowerCase())) {
                        fields.push({
                            label: fieldLabel,
                            value: safeStringify(`${test.result} ${test.unit} (${test.status})`),
                        })
                        addedFieldLabels.add(fieldLabel.toLowerCase())
                    }
                })
            }
        })
    }

    return fields
}

function safeStringify(value: any): string {
    if (value === null || value === undefined) return ""
    if (typeof value === "string") return value
    if (typeof value === "object") {
        if (Array.isArray(value)) {
            return value.map(v => safeStringify(v)).join(", ")
        }
        if (value.mr_no) return String(value.mr_no)
        if (value.reg_no) return String(value.reg_no)
        return JSON.stringify(value)
    }
    return String(value)
}

// **GET - Fetch document by job_id from documents collection**
export async function GET(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get("id")

        console.log("[PARSE-DOCUMENT GET] Request ID:", id)

        if (!id) {
            console.error("[PARSE-DOCUMENT GET] ❌ Missing ID parameter")
            return NextResponse.json({ error: "Missing document ID" }, { status: 400 })
        }

        const sessionUser = await getSessionUser(request)
        if (!sessionUser) {
            console.error("[PARSE-DOCUMENT GET] ❌ Not authorized")
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const db = await getDatabase()
        const documentsCollection = db.collection("documents")
        const webhookCollection = db.collection("webhook_responses")

        // **Priority 1: Search documents collection by job_id**
        console.log("[PARSE-DOCUMENT GET] 🔍 Searching documents collection for job_id:", id)

        let doc: any = await documentsCollection.findOne({ job_id: id })

        if (doc) {
            console.log("[PARSE-DOCUMENT GET] ✅ Found in documents collection")
        } else {
            console.log("[PARSE-DOCUMENT GET] ⚠️ Not found in documents, trying webhook_responses...")

            // **Priority 2: Search webhook_responses as fallback**
            const webhook = await webhookCollection.findOne({ job_id: id })

            if (webhook && webhook.parsed_data) {
                console.log("[PARSE-DOCUMENT GET] ✅ Found in webhook_responses, transforming...")

                // Transform webhook data to document format
                doc = {
                    job_id: webhook.job_id,
                    file_name: `Document_${webhook.job_id}`,
                    document_type: "Medical Report",
                    status: webhook.status || "completed",
                    parsed_data: webhook.parsed_data,
                    fraud_detection: webhook.fraud_detection || null,
                    created_at: webhook.received_at || new Date(),
                    confidence_score: 85,
                }
            } else {
                console.error("[PARSE-DOCUMENT GET] ❌ Document not found in any collection")
                return NextResponse.json(
                    { error: "Document not found" },
                    { status: 404 }
                )
            }
        }

        // **Ensure transformations are applied**
        if (doc.parsed_data && !doc.structured_data) {
            console.log("[PARSE-DOCUMENT GET] 🔄 Transforming parsed_data to structured_data")
            // ✅ FIX: Pass fraud_detection as separate parameter to mapParsedDataToStructured
            doc.structured_data = mapParsedDataToStructured(doc.parsed_data, doc.fraud_detection)
            doc.fields = extractFieldsFromParsedData(doc.parsed_data)
            doc.summary = buildDocumentSummary(doc.parsed_data)
        }

        // **Format response - Include complete structured data with all parsed data fields**
        const structuredData = doc.structured_data || {}
        
        // Merge parsed_data into structured data to preserve all fields
        const completeStructuredData = {
            ...structuredData,
            // Ensure medical history questions are included
            medicalHistoryQuestions: doc.parsed_data?.medical_history_questions || structuredData.medicalHistoryQuestions || [],
            // Ensure photo comparison is included
            photoComparison: doc.parsed_data?.photo_comparison || structuredData.photoComparison || null,
            // Ensure fraud detection is included - fallback chain
            fraudDetection: doc.parsed_data?.fraud_detection || doc.fraud_detection || structuredData.fraudDetection || null,
            // Ensure all raw parsed data is accessible
            rawParsedData: doc.parsed_data || {},
        }

        // ✅ Fix: Use the comprehensive fraud detection from completeStructuredData
        const formattedData = {
            id: doc.job_id || doc._id?.toString() || id,
            fileName: doc.file_name || "Untitled Document",
            fileUrl: doc.file_url || undefined,
            uploadedAt: doc.created_at?.toISOString?.() || new Date().toISOString(),
            documentType: doc.document_type || "Medical Document",
            fields: doc.fields || [],
            summary: doc.summary || "",
            notes: doc.notes || [],
            structuredData: completeStructuredData,
            confidenceScore: doc.confidence_score || undefined,
            healthRecommendations: doc.health_recommendations || undefined,
            fraudDetection: completeStructuredData.fraudDetection,
        }

        console.log("[PARSE-DOCUMENT GET] ✅ Returning formatted data")
        console.log("[PARSE-DOCUMENT GET] Medical History Questions Count:", formattedData.structuredData.medicalHistoryQuestions.length)
        console.log("[PARSE-DOCUMENT GET] Fraud Detection:", !!formattedData.fraudDetection)
        return NextResponse.json(formattedData)
    } catch (error) {
        console.error("[PARSE-DOCUMENT GET] ❌ Error:", error)
        return NextResponse.json(
            { error: "Failed to fetch document", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        )
    }
}

// **POST FUNCTION - Migrate webhooks to documents**
export async function POST(request: NextRequest) {
    try {
        const sessionUser = await getSessionUser(request)
        if (!sessionUser?.isAdmin) {
            return NextResponse.json({ error: "Admin only" }, { status: 403 })
        }

        const db = await getDatabase()
        const webhookCollection = db.collection("webhook_responses")
        const documentsCollection = db.collection("documents")

        // Get all webhooks with parsed_data
        const webhooks = await webhookCollection
            .find({ parsed_data: { $exists: true, $ne: null } })
            .toArray()

        console.log(`[MIGRATE] Found ${webhooks.length} webhooks to migrate`)

        let migratedCount = 0
        let skippedCount = 0

        for (const webhook of webhooks) {
            // Check if already exists in documents
            const exists = await documentsCollection.findOne({ job_id: webhook.job_id })

            if (exists) {
                console.log(`[MIGRATE] Skipping ${webhook.job_id} - already exists in documents`)
                skippedCount++
                continue
            }

            // Create document record from webhook
            const documentRecord = {
                job_id: webhook.job_id,
                report_id: webhook.report_id || webhook.job_id,
                file_name: `Webhook_${webhook.job_id}`,
                file_type: "medical_report",
                file_size: 0,
                document_type: "Medical Report",
                status: "completed",
                user_email: "webhook@system.com",

                // Parsed and structured data
                parsed_data: webhook.parsed_data,
                // ✅ FIX: Pass fraud_detection as separate parameter
                structured_data: mapParsedDataToStructured(webhook.parsed_data, webhook.fraud_detection),
                fields: extractFieldsFromParsedData(webhook.parsed_data),

                // Fraud detection data
                fraud_detection: webhook.fraud_detection || null,

                // Metadata
                summary: buildDocumentSummary(webhook.parsed_data),
                notes: [],
                confidence_score: 85,
                error_message: null,

                // Timestamps
                created_at: webhook.received_at || new Date(),
                updated_at: new Date(),
            }

            try {
                await documentsCollection.insertOne(documentRecord)
                console.log(`[MIGRATE] ✅ Migrated ${webhook.job_id}`)
                console.log(`[MIGRATE] 💾 Fraud Detection preserved: ${webhook.fraud_detection ? "Yes" : "No"}`)
                migratedCount++
            } catch (err) {
                console.error(`[MIGRATE] ❌ Error migrating ${webhook.job_id}:`, err)
            }
        }

        return NextResponse.json({
            success: true,
            message: `Migration complete: ${migratedCount} migrated, ${skippedCount} skipped`,
            migratedCount,
            skippedCount,
        })
    } catch (error) {
        console.error("[MIGRATE] Error:", error)
        return NextResponse.json(
            { error: "Migration failed" },
            { status: 500 }
        )
    }
}