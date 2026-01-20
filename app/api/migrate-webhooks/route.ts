import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"

// Helper functions (same as webhook)
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
            name: parsedData.patient_name || "",
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
        fraudDetection: fraudDetection || parsedData.fraud_detection || null,
    }
}

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

    if (parsedData.patient_name) {
        fields.push({
            label: "Patient Name",
            value: safeStringify(parsedData.patient_name),
        })
    }

    if (parsedData.patient_id) {
        if (typeof parsedData.patient_id === "string") {
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

// **GET - Check migration status (no auth required)**
export async function GET(request: NextRequest) {
    try {
        console.log("[MIGRATE-WEBHOOKS GET] Checking migration status...")

        const db = await getDatabase()
        const webhookCollection = db.collection("webhook_responses")
        const documentsCollection = db.collection("documents")

        const totalWebhooks = await webhookCollection.countDocuments()
        const totalDocuments = await documentsCollection.countDocuments()
        const webhooksWithParsedData = await webhookCollection.countDocuments({
            parsed_data: { $exists: true, $ne: null }
        })
        const webhooksNotMigrated = await webhookCollection.countDocuments({
            parsed_data: { $exists: true, $ne: null },
            processed: { $ne: true }
        })
        
        // ✅ NEW: Check webhooks with fraud_detection
        const webhooksWithFraudDetection = await webhookCollection.countDocuments({
            fraud_detection: { $exists: true, $ne: null }
        })
        
        const documentsWithFraudDetection = await documentsCollection.countDocuments({
            fraud_detection: { $exists: true, $ne: null }
        })

        console.log("[MIGRATE-WEBHOOKS GET] Status:", {
            totalWebhooks,
            totalDocuments,
            webhooksWithParsedData,
            webhooksNotMigrated,
            webhooksWithFraudDetection,
            documentsWithFraudDetection,
        })

        return NextResponse.json({
            status: "Migration Status",
            webhooks: {
                total: totalWebhooks,
                withParsedData: webhooksWithParsedData,
                withFraudDetection: webhooksWithFraudDetection,
                notMigrated: webhooksNotMigrated,
            },
            documents: {
                total: totalDocuments,
                withFraudDetection: documentsWithFraudDetection,
            },
            readyToMigrate: webhooksNotMigrated,
        })
    } catch (error) {
        console.error("[MIGRATE-WEBHOOKS GET] Error:", error)
        return NextResponse.json(
            { error: "Failed to get status", details: error instanceof Error ? error.message : "Unknown" },
            { status: 500 }
        )
    }
}

// **POST - Run migration (no auth required)**
export async function POST(request: NextRequest) {
    console.log("[MIGRATE-WEBHOOKS POST] ===== MIGRATION STARTED =====")

    try {
        const db = await getDatabase()
        const webhookCollection = db.collection("webhook_responses")
        const documentsCollection = db.collection("documents")

        // Find all webhooks with parsed_data that haven't been migrated
        const webhooksToMigrate = await webhookCollection
            .find({
                parsed_data: { $exists: true, $ne: null },
                processed: { $ne: true }
            })
            .toArray()

        console.log(`[MIGRATE-WEBHOOKS POST] Found ${webhooksToMigrate.length} webhooks to migrate`)

        let migratedCount = 0
        let skippedCount = 0
        let fraudDetectionMigratedCount = 0
        const errors: any[] = []

        for (const webhook of webhooksToMigrate) {
            try {
                console.log(`[MIGRATE-WEBHOOKS POST] Processing job_id: ${webhook.job_id}`)

                // Check if already exists in documents
                const existingDoc = await documentsCollection.findOne({ job_id: webhook.job_id })
                if (existingDoc) {
                    console.log(`[MIGRATE-WEBHOOKS POST] ⏭️ Skipping ${webhook.job_id} - already in documents`)
                    skippedCount++
                    continue
                }

                // ✅ CRITICAL FIX: Properly extract fraud_detection
                const fraudDetection = webhook.fraud_detection || webhook.parsed_data?.fraud_detection || null

                // Create document from webhook
                const documentRecord = {
                    job_id: webhook.job_id,
                    report_id: webhook.report_id || webhook.job_id,
                    file_name: `Document_${webhook.job_id}`,
                    file_type: "medical_report",
                    file_size: 0,
                    document_type: "Medical Report",
                    status: webhook.status || "completed",
                    user_email: "webhook@system.com",

                    // Parsed and structured data
                    parsed_data: webhook.parsed_data,
                    structured_data: mapParsedDataToStructured(webhook.parsed_data, fraudDetection),
                    fields: extractFieldsFromParsedData(webhook.parsed_data),

                    // ✅ CRITICAL FIX: Always add fraud_detection field
                    fraud_detection: fraudDetection,

                    // Metadata
                    summary: buildDocumentSummary(webhook.parsed_data),
                    notes: [],
                    confidence_score: 85,
                    error_message: null,

                    // Timestamps
                    created_at: webhook.received_at || new Date(),
                    updated_at: new Date(),
                }

                const result = await documentsCollection.insertOne(documentRecord)
                
                // ✅ Log fraud detection status
                if (fraudDetection) {
                    console.log(`[MIGRATE-WEBHOOKS POST] ✅ Migrated ${webhook.job_id} with fraud_detection`)
                    console.log(`[MIGRATE-WEBHOOKS POST] 📊 Fraud Detection Data:`, JSON.stringify(fraudDetection).substring(0, 150))
                    fraudDetectionMigratedCount++
                } else {
                    console.log(`[MIGRATE-WEBHOOKS POST] ✅ Migrated ${webhook.job_id} (no fraud_detection)`)
                }
                
                migratedCount++

                // Mark webhook as processed AFTER successful document creation
                await webhookCollection.updateOne(
                    { _id: webhook._id },
                    {
                        $set: {
                            processed: true,
                            document_id: result.insertedId.toString(),
                            migrated_at: new Date(),
                        }
                    }
                )
            } catch (err) {
                const errMsg = `Error migrating ${webhook.job_id}: ${err instanceof Error ? err.message : String(err)}`
                console.error(`[MIGRATE-WEBHOOKS POST] ❌ ${errMsg}`)
                errors.push({
                    job_id: webhook.job_id,
                    error: errMsg,
                })
            }
        }

        console.log(`[MIGRATE-WEBHOOKS POST] ===== MIGRATION COMPLETE =====`)
        console.log(`[MIGRATE-WEBHOOKS POST] Summary:`)
        console.log(`  - Total migrated: ${migratedCount}`)
        console.log(`  - With fraud_detection: ${fraudDetectionMigratedCount}`)
        console.log(`  - Skipped: ${skippedCount}`)
        console.log(`  - Errors: ${errors.length}`)

        return NextResponse.json({
            success: true,
            message: `Migration complete: ${migratedCount} migrated, ${skippedCount} skipped`,
            migratedCount,
            fraudDetectionMigratedCount,
            skippedCount,
            errors: errors.length > 0 ? errors : undefined,
        })
    } catch (error) {
        console.error("[MIGRATE-WEBHOOKS POST] ❌ Fatal error:", error)
        return NextResponse.json(
            { error: "Migration failed", details: error instanceof Error ? error.message : "Unknown" },
            { status: 500 }
        )
    }
}