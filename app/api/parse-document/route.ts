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
        // Add medical history questions - stored only once
        medicalHistoryQuestions: parsedData.medical_history_questions || [],
        // Preserve photo comparison data
        photoComparison: parsedData.photo_comparison || null,
        // Updated: Use !== null check for consistency with webhook version
        fraudDetection: fraudDetection !== null ? fraudDetection : (parsedData.fraud_detection || null),
        // ✅ ADD RAW PARSED DATA FOR DISPLAY IN RAW TAB
        rawParsedData: parsedData,
    }
}
function extractVitalSigns(parsedData: any) {
    const vitalSigns: Record<string, any> = {}
    if (parsedData.lab_results && Array.isArray(parsedData.lab_results)) {
        parsedData.lab_results.forEach((exam: any) => {
            // Updated: Match the examination name from data ("Vitals and Body Composition")
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

// **GET - Fetch document directly from webhook_responses and bind to structured format**
export async function GET(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get("id")
        const download = request.nextUrl.searchParams.get("download")
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
        const webhookCollection = db.collection("webhook_responses")
        const jobCollection = db.collection("job_ids")

        // **Direct binding: Fetch from webhook_responses**
        console.log("[PARSE-DOCUMENT GET] 🔍 Fetching from webhook_responses for job_id:", id)
        const webhook = await webhookCollection.findOne({ job_id: id })

        if (!webhook) {
            console.error("[PARSE-DOCUMENT GET] ❌ Document not found in webhook_responses")
            return NextResponse.json(
                { error: "Document not found" },
                { status: 404 }
            )
        }

        if (!webhook.parsed_data) {
            console.error("[PARSE-DOCUMENT GET] ❌ No parsed_data in webhook response")
            return NextResponse.json(
                { error: "Document has no parsed data" },
                { status: 404 }
            )
        }

        console.log("[PARSE-DOCUMENT GET] ✅ Found in webhook_responses")

        // Get job info for user email and filename
        const jobRecord = await jobCollection.findOne({ job_id: id })
        const userEmail = jobRecord?.user_email || "anonymous"
        const fileName = jobRecord?.file_name || `Document_${id}`

        // **Transform webhook data to structured format**
        const enrichedParsedData = {
            ...webhook.parsed_data,
            fraud_detection: webhook.fraud_detection,
        }

        const doc = {
            job_id: webhook.job_id,
            file_name: fileName,
            document_type: "Medical Report",
            status: webhook.status || "completed",
            parsed_data: enrichedParsedData,
            fraud_detection: webhook.fraud_detection || null,
            created_at: webhook.received_at || new Date(),
            confidence_score: 85,
            user_email: userEmail,
        }

        // **Handle raw data download**
        // **Handle raw data download**
        if (download === "raw") {
            console.log("[PARSE-DOCUMENT GET] 📥 Generating raw data download")
            // Transform to get rawParsedData
            const structured_data = mapParsedDataToStructured(doc.parsed_data, doc.fraud_detection)
            // Extract ONLY rawParsedData for download
            const rawDataOnly = structured_data.rawParsedData

            if (!rawDataOnly) {
                return NextResponse.json(
                    { error: "Raw parsed data not available" },
                    { status: 404 }
                )
            }

            const jsonContent = JSON.stringify(rawDataOnly, null, 2)
            const sanitizedFileName = fileName.replace(/[^a-z0-9-_.]/gi, "_")
            const downloadFileName = `${sanitizedFileName}_raw_${new Date().toISOString().split("T")[0]}.json`

            console.log("[PARSE-DOCUMENT GET] 📥 Raw data download ready:", downloadFileName)

            return new NextResponse(jsonContent, {
                status: 200,
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "Content-Disposition": `attachment; filename="${downloadFileName}"`,
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0",
                },
            })
        }

        // **Transform to structured data**
        console.log("[PARSE-DOCUMENT GET] 🔄 Transforming parsed_data to structured_data")
        const structured_data = mapParsedDataToStructured(doc.parsed_data, doc.fraud_detection)
        const fields = extractFieldsFromParsedData(doc.parsed_data)
        const summary = buildDocumentSummary(doc.parsed_data)

        // **Format response - Do NOT duplicate data, use structured format only**
        const formattedData = {
            id: doc.job_id || id,
            fileName: doc.file_name || "Untitled Document",
            uploadedAt: doc.created_at?.toISOString?.() || new Date().toISOString(),
            documentType: doc.document_type || "Medical Document",
            fields: fields || [],
            summary: summary || "",
            structuredData: structured_data,
            confidenceScore: doc.confidence_score || undefined,
            fraudDetection: structured_data.fraudDetection,
        }

        console.log("[PARSE-DOCUMENT GET] ✅ Returning formatted data from webhook_responses")
        console.log("[PARSE-DOCUMENT GET] Medical History Questions Count:", structured_data.medicalHistoryQuestions.length)
        console.log("[PARSE-DOCUMENT GET] Fraud Detection:", !!formattedData.fraudDetection)
        console.log("[PARSE-DOCUMENT GET] Raw Parsed Data included:", !!structured_data.rawParsedData)
        return NextResponse.json(formattedData)
    } catch (error) {
        console.error("[PARSE-DOCUMENT GET] ❌ Error:", error)
        return NextResponse.json(
            { error: "Failed to fetch document", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        )
    }
}

// **DELETE - Clear all documents from documents collection**
export async function DELETE(request: NextRequest) {
    try {
        const sessionUser = await getSessionUser(request)
        if (!sessionUser?.isAdmin) {
            return NextResponse.json({ error: "Admin only" }, { status: 403 })
        }

        const db = await getDatabase()
        const documentsCollection = db.collection("documents")

        console.log("[PARSE-DOCUMENT DELETE] 🗑️ Deleting all documents from collection...")
        const result = await documentsCollection.deleteMany({})

        console.log("[PARSE-DOCUMENT DELETE] ✅ Deleted", result.deletedCount, "documents")

        return NextResponse.json({
            success: true,
            message: `Successfully deleted ${result.deletedCount} documents`,
            deletedCount: result.deletedCount,
        })
    } catch (error) {
        console.error("[PARSE-DOCUMENT DELETE] ❌ Error:", error)
        return NextResponse.json(
            { error: "Failed to delete documents" },
            { status: 500 }
        )
    }
}

// **POST FUNCTION - Migrate webhooks to documents (optional - can be removed if not needed)**
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
            // Enrich parsed_data to match webhook POST behavior
            const enrichedParsedData = {
                ...webhook.parsed_data,
                fraud_detection: webhook.fraud_detection,
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
                // Parsed and structured data - Use clean mapping without duplication
                parsed_data: enrichedParsedData,
                structured_data: mapParsedDataToStructured(enrichedParsedData, webhook.fraud_detection),
                fields: extractFieldsFromParsedData(enrichedParsedData),
                // Fraud detection data
                fraud_detection: webhook.fraud_detection || null,
                // Metadata
                summary: buildDocumentSummary(enrichedParsedData),
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
                console.log(`[MIGRATE] 💾 Medical History Questions: ${documentRecord.structured_data.medicalHistoryQuestions?.length || 0}`)
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