import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 300 // 5 minutes for Pro/Enterprise plans
export const dynamic = "force-dynamic"

function calculateConfidenceScore(extractedData: any, apiSuccess: boolean, modelConfidence?: number): number {
  if (!apiSuccess) return 0

  // Start with model's self-reported confidence or default to 70
  let confidence = modelConfidence || 70

  // Calculate data completeness score
  const totalFields = [
    extractedData.patientInfo.fullName,
    extractedData.documentInfo.type,
    extractedData.providerInfo.hospitalName,
    extractedData.providerInfo.doctorName,
    extractedData.clinicalData.diagnosis,
  ].filter(Boolean).length

  const hasArrayData =
    [
      ...(extractedData.clinicalData.medications || []),
      ...(extractedData.clinicalData.procedures || []),
      ...(extractedData.clinicalData.labResults || []),
    ].length > 0

  // Adjust confidence based on data completeness
  if (totalFields >= 4) {
    confidence += 10 // Good data completeness
  } else if (totalFields >= 2) {
    confidence += 5 // Moderate data completeness
  } else {
    confidence -= 20 // Poor data completeness
  }

  if (hasArrayData) {
    confidence += 10 // Has detailed medical data
  }

  // Ensure confidence is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(confidence)))
}

export async function POST(request: NextRequest) {
  console.log("[v0] API route called - START")
  console.log("[v0] Environment check:", {
    hasGoogleKey: !!(process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    nodeEnv: process.env.NODE_ENV,
  })

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) {
    console.error("[v0] ERROR: GOOGLE_GEMINI_API_KEY environment variable is not set")
    return NextResponse.json(
      { error: "Google API key not configured. Please add GOOGLE_GEMINI_API_KEY to your environment variables." },
      { status: 500 },
    )
  }

  try {
    const formData = await request.formData()
    const files = formData.getAll("files") as File[]
    const originalFileName = formData.get("originalFileName") as string
    const isMultiPage = formData.get("isMultiPage") === "true"

    if (!files || files.length === 0) {
      console.log("[v0] ERROR: No files provided")
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    console.log("[v0] Files received:", files.length, "files from:", originalFileName)

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"]
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: "Only PNG, JPG, and JPEG images are supported" }, { status: 400 })
      }
    }

    const supabase = await createClient()

    const uploadedImageUrls: string[] = []
    const timestamp = Date.now()

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const storagePath = `documents/${timestamp}-${fileName}`

      console.log(`[v0] Uploading image ${i + 1}/${files.length} to storage:`, storagePath)

      const fileBuffer = await file.arrayBuffer()
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("medical-documents")
        .upload(storagePath, fileBuffer, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) {
        console.error("[v0] Storage upload failed:", uploadError)
        return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 })
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("medical-documents").getPublicUrl(uploadData.path)

      uploadedImageUrls.push(publicUrl)
      console.log(`[v0] Image ${i + 1} uploaded:`, publicUrl)
    }

    console.log("[v0] Processing", files.length, "images with Gemini 2.5 Pro model...")
    const allExtractedData: any[] = []
    const pageConfidenceScores: number[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      console.log(`[v0] Processing image ${i + 1}/${files.length}...`)

      const fileBuffer = await file.arrayBuffer()
      const base64 = Buffer.from(fileBuffer).toString("base64")

      const prompt = `You are an expert medical document AI parser specialized in extracting structured data from healthcare documents.

TASK: Analyze this medical document image (page ${i + 1} of ${files.length}) and extract ALL visible information into a structured JSON format.

OUTPUT FORMAT: Return ONLY a valid JSON object. No markdown formatting, no code blocks, no explanatory text - just pure JSON.

REQUIRED JSON STRUCTURE:
{
  "patientInfo": {
    "fullName": "Complete patient name with title (Mr./Mrs./Ms.)",
    "dateOfBirth": "YYYY-MM-DD format or null",
    "age": "Age with units (e.g., 45 years, 6 months) or null",
    "gender": "Male/Female/Other or null",
    "medicalRecordNumber": "MRN/UHID/Patient ID or null",
    "ipAdmissionNumber": "IP/Admission number or null"
  },
  "documentInfo": {
    "type": "Specific document type (e.g., Discharge Summary, Lab Report, Prescription, MRI Report)",
    "reportDate": "YYYY-MM-DD or null",
    "admissionDate": "YYYY-MM-DD or null",
    "dischargeDate": "YYYY-MM-DD or null"
  },
  "providerInfo": {
    "hospitalName": "Full hospital/clinic name",
    "department": "Department name or null",
    "doctorName": "Doctor name with title (Dr./Prof.) or null",
    "consultantName": "Consultant name if different from doctor or null",
    "contactNumbers": ["phone1", "phone2"] or []
  },
  "clinicalData": {
    "chiefComplaint": "Primary reason for visit or null",
    "diagnosis": "Primary diagnosis or condition",
    "secondaryDiagnoses": ["diagnosis1", "diagnosis2"] or [],
    "procedures": [
      {"name": "procedure name", "date": "YYYY-MM-DD or null", "details": "additional info"}
    ] or [],
    "medications": [
      {"name": "medication name", "dosage": "dosage info", "frequency": "frequency", "duration": "duration"}
    ] or [],
    "labResults": [
      {
        "test": "test name (e.g., Hemoglobin, Blood Glucose, Creatinine)",
        "measuredValue": "actual result value (e.g., 120, 14.5, 0.9)",
        "unit": "measurement unit (e.g., mg/dL, g/dL, mmol/L, "%")",
        "referenceRange": "normal range (e.g., 70-100, 12-16, 0.6-1.2)",
        "status": "Normal/High/Low/Critical based on reference range comparison",
        "method": "test method if mentioned or null",
        "notes": "any additional notes about the result or null"
      }
    ] or [],
    "vitalSigns": {
      "bloodPressure": "BP value or null",
      "heartRate": "HR value or null",
      "temperature": "temp value or null",
      "respiratoryRate": "RR value or null",
      "oxygenSaturation": "SpO2 value or null",
      "weight": "weight value or null",
      "height": "height value or null",
      "bmi": "BMI value or null"
    },
    "allergies": ["allergy1", "allergy2"] or [],
    "medicalHistory": "Relevant past medical history or null",
    "familyHistory": "Relevant family history or null"
  },
  "treatmentPlan": {
    "dietaryAdvice": "Diet recommendations or null",
    "activityRestrictions": "Activity limitations or null",
    "followUpInstructions": "Follow-up care details or null",
    "followUpDate": "YYYY-MM-DD or null",
    "specialInstructions": "Any special care instructions or null"
  },
  "billingInfo": {
    "totalAmount": "Total bill with currency (e.g., ₹15,000 or $500) or null",
    "consultationFee": "Doctor consultation charges or null",
    "roomCharges": "Room/bed charges or null",
    "procedureCosts": [
      {"procedure": "procedure name", "cost": "cost with currency"}
    ] or [],
    "medicationCosts": [
      {"medication": "medication name", "cost": "cost with currency"}
    ] or [],
    "labTestCosts": [
      {"test": "test name", "cost": "cost with currency"}
    ] or [],
    "otherCharges": [
      {"description": "charge description", "amount": "amount with currency"}
    ] or [],
    "subtotal": "Subtotal before discounts or null",
    "discount": "Discount amount or percentage or null",
    "taxAmount": "Tax amount or null",
    "insuranceCovered": "Insurance coverage amount or null",
    "patientPayable": "Amount patient needs to pay or null",
    "paymentStatus": "Paid/Pending/Partial/Not Paid or null",
    "paymentMethod": "Cash/Card/Insurance/UPI or null",
    "invoiceNumber": "Invoice/bill number or null",
    "receiptNumber": "Receipt number or null"
  },
  "imagingAndTests": {
    "imagingStudies": [
      {"type": "X-Ray/CT/MRI/Ultrasound", "bodyPart": "area scanned", "findings": "key findings", "date": "YYYY-MM-DD or null"}
    ] or [],
    "pathologyReports": [
      {"test": "test name", "specimen": "specimen type", "findings": "findings", "date": "YYYY-MM-DD or null"}
    ] or []
  },
  "additionalData": [
    {"fieldName": "Any other field found", "fieldValue": "value"}
  ] or [],
  "documentSummary": "Comprehensive 2-3 sentence summary of this page's key information",
  "extractionMetadata": {
    "confidenceScore": 85,
    "confidenceReasoning": "Brief explanation of confidence level",
    "dataQuality": "Excellent/Good/Fair/Poor",
    "legibilityIssues": ["issue1", "issue2"] or []
  }
}

CRITICAL: LAB RESULTS EXTRACTION
For each lab test, you MUST extract:
1. measuredValue: The actual test result (e.g., "120", "14.5", "0.9")
2. unit: The measurement unit (e.g., "mg/dL", "g/dL", "mmol/L", "%")
3. referenceRange: The normal/reference range shown (e.g., "70-100", "12-16", "0.6-1.2")
4. status: Compare measuredValue to referenceRange and determine Normal/High/Low/Critical

CONFIDENCE SCORING GUIDELINES:
- 95-100: Crystal clear document, all text perfectly legible, complete information
- 85-94: Very clear document, minor blur or slight incompleteness
- 70-84: Generally clear, some sections unclear or missing, most data extractable
- 50-69: Moderate clarity, significant portions unclear or missing
- 30-49: Poor quality, heavily degraded or incomplete, limited data extractable
- 0-29: Severely degraded, mostly illegible, minimal data extractable

Begin extraction now. Return only the JSON object.`

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                  {
                    inline_data: {
                      mime_type: file.type,
                      data: base64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
            },
          }),
        },
      )

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text()
        console.error(`[v0] Gemini API error for image ${i + 1}:`, geminiResponse.status, errorText.substring(0, 200))

        console.warn(`[v0] Using fallback structure for image ${i + 1} due to API error`)
        pageConfidenceScores.push(0)
        allExtractedData.push({
          patientInfo: {
            fullName: null,
            dateOfBirth: null,
            age: null,
            gender: null,
            medicalRecordNumber: null,
            ipAdmissionNumber: null,
          },
          documentInfo: {
            type: null,
            reportDate: null,
            admissionDate: null,
            dischargeDate: null,
          },
          providerInfo: {
            hospitalName: null,
            department: null,
            doctorName: null,
            consultantName: null,
            contactNumbers: [],
          },
          clinicalData: {
            chiefComplaint: null,
            diagnosis: null,
            secondaryDiagnoses: [],
            procedures: [],
            medications: [],
            labResults: [],
            vitalSigns: {
              bloodPressure: null,
              heartRate: null,
              temperature: null,
              respiratoryRate: null,
              oxygenSaturation: null,
              weight: null,
              height: null,
              bmi: null,
            },
            allergies: [],
            medicalHistory: null,
            familyHistory: null,
          },
          treatmentPlan: {
            dietaryAdvice: null,
            activityRestrictions: null,
            followUpInstructions: null,
            followUpDate: null,
            specialInstructions: null,
          },
          billingInfo: {
            totalAmount: null,
            consultationFee: null,
            roomCharges: null,
            procedureCosts: [],
            medicationCosts: [],
            labTestCosts: [],
            otherCharges: [],
            subtotal: null,
            discount: null,
            taxAmount: null,
            insuranceCovered: null,
            patientPayable: null,
            paymentStatus: null,
            paymentMethod: null,
            invoiceNumber: null,
            receiptNumber: null,
          },
          imagingAndTests: {
            imagingStudies: [],
            pathologyReports: [],
          },
          additionalData: [],
          documentSummary: `Page ${i + 1} could not be processed - API error: ${geminiResponse.status}`,
          extractionMetadata: {
            confidenceScore: 0,
            confidenceReasoning: null,
            dataQuality: null,
            legibilityIssues: [],
          },
        })
        continue
      }

      let responseText: string
      try {
        const geminiData = await geminiResponse.json()
        responseText = geminiData.candidates[0].content.parts[0].text
      } catch (textError) {
        console.error(`[v0] Failed to read Gemini response for image ${i + 1}:`, textError)
        console.warn(`[v0] Using fallback structure for image ${i + 1} due to response read error`)
        pageConfidenceScores.push(0)
        allExtractedData.push({
          patientInfo: {
            fullName: null,
            dateOfBirth: null,
            age: null,
            gender: null,
            medicalRecordNumber: null,
            ipAdmissionNumber: null,
          },
          documentInfo: {
            type: null,
            reportDate: null,
            admissionDate: null,
            dischargeDate: null,
          },
          providerInfo: {
            hospitalName: null,
            department: null,
            doctorName: null,
            consultantName: null,
            contactNumbers: [],
          },
          clinicalData: {
            chiefComplaint: null,
            diagnosis: null,
            secondaryDiagnoses: [],
            procedures: [],
            medications: [],
            labResults: [],
            vitalSigns: {
              bloodPressure: null,
              heartRate: null,
              temperature: null,
              respiratoryRate: null,
              oxygenSaturation: null,
              weight: null,
              height: null,
              bmi: null,
            },
            allergies: [],
            medicalHistory: null,
            familyHistory: null,
          },
          treatmentPlan: {
            dietaryAdvice: null,
            activityRestrictions: null,
            followUpInstructions: null,
            followUpDate: null,
            specialInstructions: null,
          },
          billingInfo: {
            totalAmount: null,
            consultationFee: null,
            roomCharges: null,
            procedureCosts: [],
            medicationCosts: [],
            labTestCosts: [],
            otherCharges: [],
            subtotal: null,
            discount: null,
            taxAmount: null,
            insuranceCovered: null,
            patientPayable: null,
            paymentStatus: null,
            paymentMethod: null,
            invoiceNumber: null,
            receiptNumber: null,
          },
          imagingAndTests: {
            imagingStudies: [],
            pathologyReports: [],
          },
          additionalData: [],
          documentSummary: `Page ${i + 1} could not be processed - Response read error`,
          extractionMetadata: {
            confidenceScore: 0,
            confidenceReasoning: null,
            dataQuality: null,
            legibilityIssues: [],
          },
        })
        continue
      }

      let parsedData
      try {
        parsedData = JSON.parse(responseText)
        console.log(`[v0] ✓ Direct JSON parse successful for image ${i + 1}`)
      } catch (e1) {
        console.log(`[v0] Direct parse failed for image ${i + 1}, trying markdown extraction...`)
        try {
          const jsonMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
          if (jsonMatch) {
            parsedData = JSON.parse(jsonMatch[1].trim())
            console.log(`[v0] ✓ Markdown extraction successful for image ${i + 1}`)
          } else {
            throw new Error("No code block found")
          }
        } catch (e2) {
          console.log(`[v0] Markdown extraction failed for image ${i + 1}, trying regex extraction...`)
          try {
            const jsonObjectMatch = responseText.match(/\{[\s\S]*\}/)
            if (jsonObjectMatch) {
              let jsonStr = jsonObjectMatch[0]
              jsonStr = jsonStr
                .replace(/,\s*}/g, "}")
                .replace(/,\s*]/g, "]")
                .replace(/\n/g, " ")
                .replace(/\r/g, "")
                .replace(/\t/g, " ")
                .replace(/\s+/g, " ")

              parsedData = JSON.parse(jsonStr)
              console.log(`[v0] ✓ Regex extraction with cleanup successful for image ${i + 1}`)
            } else {
              throw new Error("No JSON object found")
            }
          } catch (e3) {
            console.error(`[v0] ❌ All JSON parsing attempts failed for image ${i + 1}`)
            console.error(`[v0] AI Response preview (first 500 chars):`, responseText.substring(0, 500))
            console.error(
              `[v0] AI Response preview (last 500 chars):`,
              responseText.substring(Math.max(0, responseText.length - 500)),
            )

            console.warn(`[v0] Using fallback structure for image ${i + 1}`)
            pageConfidenceScores.push(0)
            parsedData = {
              patientInfo: {
                fullName: null,
                dateOfBirth: null,
                age: null,
                gender: null,
                medicalRecordNumber: null,
                ipAdmissionNumber: null,
              },
              documentInfo: {
                type: null,
                reportDate: null,
                admissionDate: null,
                dischargeDate: null,
              },
              providerInfo: {
                hospitalName: null,
                department: null,
                doctorName: null,
                consultantName: null,
                contactNumbers: [],
              },
              clinicalData: {
                chiefComplaint: null,
                diagnosis: null,
                secondaryDiagnoses: [],
                procedures: [],
                medications: [],
                labResults: [],
                vitalSigns: {
                  bloodPressure: null,
                  heartRate: null,
                  temperature: null,
                  respiratoryRate: null,
                  oxygenSaturation: null,
                  weight: null,
                  height: null,
                  bmi: null,
                },
                allergies: [],
                medicalHistory: null,
                familyHistory: null,
              },
              treatmentPlan: {
                dietaryAdvice: null,
                activityRestrictions: null,
                followUpInstructions: null,
                followUpDate: null,
                specialInstructions: null,
              },
              billingInfo: {
                totalAmount: null,
                consultationFee: null,
                roomCharges: null,
                procedureCosts: [],
                medicationCosts: [],
                labTestCosts: [],
                otherCharges: [],
                subtotal: null,
                discount: null,
                taxAmount: null,
                insuranceCovered: null,
                patientPayable: null,
                paymentStatus: null,
                paymentMethod: null,
                invoiceNumber: null,
                receiptNumber: null,
              },
              imagingAndTests: {
                imagingStudies: [],
                pathologyReports: [],
              },
              additionalData: [],
              documentSummary: `Page ${i + 1} content could not be parsed - JSON parsing failed`,
              extractionMetadata: {
                confidenceScore: 0,
                confidenceReasoning: null,
                dataQuality: null,
                legibilityIssues: [],
              },
            }
          }
        }
      }

      const modelConfidence = parsedData.extractionMetadata.confidenceScore || undefined
      const pageConfidence = calculateConfidenceScore(parsedData, true, modelConfidence)
      pageConfidenceScores.push(pageConfidence)
      console.log(`[v0] Page ${i + 1} confidence score: ${pageConfidence}%`)

      allExtractedData.push(parsedData)
    }

    console.log("[v0] Combining data from", allExtractedData.length, "pages...")

    const structuredData = {
      patient: {
        name: allExtractedData.find((d) => d.patientInfo.fullName)?.patientInfo.fullName || "Unknown",
        dateOfBirth: allExtractedData.find((d) => d.patientInfo.dateOfBirth)?.patientInfo.dateOfBirth || null,
        age: allExtractedData.find((d) => d.patientInfo.age)?.patientInfo.age || null,
        gender: allExtractedData.find((d) => d.patientInfo.gender)?.patientInfo.gender || null,
        mrNumber:
          allExtractedData.find((d) => d.patientInfo.medicalRecordNumber)?.patientInfo.medicalRecordNumber || null,
        ipNumber: allExtractedData.find((d) => d.patientInfo.ipAdmissionNumber)?.patientInfo.ipAdmissionNumber || null,
      },
      document: {
        type: allExtractedData.find((d) => d.documentInfo.type)?.documentInfo.type || "Medical Document",
        reportDate: allExtractedData.find((d) => d.documentInfo.reportDate)?.documentInfo.reportDate || null,
        admissionDate: allExtractedData.find((d) => d.documentInfo.admissionDate)?.documentInfo.admissionDate || null,
        dischargeDate: allExtractedData.find((d) => d.documentInfo.dischargeDate)?.documentInfo.dischargeDate || null,
      },
      hospital: {
        name: allExtractedData.find((d) => d.providerInfo.hospitalName)?.providerInfo.hospitalName || null,
        department: allExtractedData.find((d) => d.providerInfo.department)?.providerInfo.department || null,
        doctor: allExtractedData.find((d) => d.providerInfo.doctorName)?.providerInfo.doctorName || null,
        consultant: allExtractedData.find((d) => d.providerInfo.consultantName)?.providerInfo.consultantName || null,
        contactNumbers: Array.from(new Set(allExtractedData.flatMap((d) => d.providerInfo.contactNumbers || []))),
      },
      medical: {
        chiefComplaint:
          allExtractedData.find((d) => d.clinicalData.chiefComplaint)?.clinicalData.chiefComplaint || null,
        diagnosis: allExtractedData.find((d) => d.clinicalData.diagnosis)?.clinicalData.diagnosis || null,
        secondaryDiagnoses: Array.from(
          new Set(allExtractedData.flatMap((d) => d.clinicalData.secondaryDiagnoses || [])),
        ),
        procedures: Array.from(new Set(allExtractedData.flatMap((d) => d.clinicalData.procedures || []))),
        medications: Array.from(new Set(allExtractedData.flatMap((d) => d.clinicalData.medications || []))),
        labResults: Array.from(new Set(allExtractedData.flatMap((d) => d.clinicalData.labResults || []))),
        vitalSigns: Array.from(
          new Set(
            allExtractedData.flatMap((d) =>
              Object.entries(d.clinicalData.vitalSigns || {}).map(([key, value]) => ({ key, value })),
            ),
          ),
        ),
        allergies: Array.from(new Set(allExtractedData.flatMap((d) => d.clinicalData.allergies || []))),
        medicalHistory:
          allExtractedData.find((d) => d.clinicalData.medicalHistory)?.clinicalData.medicalHistory || null,
        familyHistory: allExtractedData.find((d) => d.clinicalData.familyHistory)?.clinicalData.familyHistory || null,
      },
      treatment: {
        dietaryAdvice: allExtractedData.flatMap((d) =>
          d.treatmentPlan.dietaryAdvice ? [d.treatmentPlan.dietaryAdvice] : [],
        ),
        activityRestrictions: allExtractedData.flatMap((d) =>
          d.treatmentPlan.activityRestrictions ? [d.treatmentPlan.activityRestrictions] : [],
        ),
        followUpInstructions: allExtractedData.flatMap((d) =>
          d.treatmentPlan.followUpInstructions ? [d.treatmentPlan.followUpInstructions] : [],
        ),
        followUpDate: allExtractedData.find((d) => d.treatmentPlan.followUpDate)?.treatmentPlan.followUpDate || null,
        specialInstructions: allExtractedData.flatMap((d) =>
          d.treatmentPlan.specialInstructions ? [d.treatmentPlan.specialInstructions] : [],
        ),
      },
      billing: {
        totalAmount: allExtractedData.find((d) => d.billingInfo.totalAmount)?.billingInfo.totalAmount || null,
        consultationFee:
          allExtractedData.find((d) => d.billingInfo.consultationFee)?.billingInfo.consultationFee || null,
        roomCharges: allExtractedData.find((d) => d.billingInfo.roomCharges)?.billingInfo.roomCharges || null,
        procedureCosts: Array.from(new Set(allExtractedData.flatMap((d) => d.billingInfo.procedureCosts || []))),
        medicationCosts: Array.from(new Set(allExtractedData.flatMap((d) => d.billingInfo.medicationCosts || []))),
        labTestCosts: Array.from(new Set(allExtractedData.flatMap((d) => d.billingInfo.labTestCosts || []))),
        otherCharges: Array.from(new Set(allExtractedData.flatMap((d) => d.billingInfo.otherCharges || []))),
        subtotal: allExtractedData.find((d) => d.billingInfo.subtotal)?.billingInfo.subtotal || null,
        discount: allExtractedData.find((d) => d.billingInfo.discount)?.billingInfo.discount || null,
        taxAmount: allExtractedData.find((d) => d.billingInfo.taxAmount)?.billingInfo.taxAmount || null,
        insuranceCovered:
          allExtractedData.find((d) => d.billingInfo.insuranceCovered)?.billingInfo.insuranceCovered || null,
        patientPayable: allExtractedData.find((d) => d.billingInfo.patientPayable)?.billingInfo.patientPayable || null,
        paymentStatus: allExtractedData.find((d) => d.billingInfo.paymentStatus)?.billingInfo.paymentStatus || null,
        paymentMethod: allExtractedData.find((d) => d.billingInfo.paymentMethod)?.billingInfo.paymentMethod || null,
        invoiceNumber: allExtractedData.find((d) => d.billingInfo.invoiceNumber)?.billingInfo.invoiceNumber || null,
        receiptNumber: allExtractedData.find((d) => d.billingInfo.receiptNumber)?.billingInfo.receiptNumber || null,
      },
      imaging: {
        imagingStudies: Array.from(new Set(allExtractedData.flatMap((d) => d.imagingAndTests.imagingStudies || []))),
        pathologyReports: Array.from(
          new Set(allExtractedData.flatMap((d) => d.imagingAndTests.pathologyReports || [])),
        ),
      },
      additionalFields: allExtractedData.flatMap((d) => d.additionalData || []),
      summary: allExtractedData.map((d, i) => `Page ${i + 1}: ${d.documentSummary}`).join("\n\n"),
      rawPages: allExtractedData,
    }

    console.log("[v0] Structured data created:", JSON.stringify(structuredData, null, 2))

    let healthRecommendations = null
    try {
      console.log("[v0] Generating health recommendations...")

      const recommendationPrompt = `You are a medical AI assistant analyzing patient health data. Based on the following medical information, provide personalized health recommendations. Be specific, actionable, and evidence-based.

Patient Medical Data:
${JSON.stringify(
  {
    diagnosis: structuredData.medical.diagnosis,
    medications: structuredData.medical.medications,
    labResults: structuredData.medical.labResults,
    vitalSigns: structuredData.medical.vitalSigns,
    allergies: structuredData.medical.allergies,
    medicalHistory: structuredData.medical.medicalHistory,
    procedures: structuredData.medical.procedures,
    treatmentPlan: structuredData.treatment,
  },
  null,
  2,
)}

Provide recommendations in the following JSON structure:
{
  "summary": "Brief 1-2 sentence overview of patient's condition",
  "recommendations": [
    {
      "category": "medication|lifestyle|followup|monitoring|diet|exercise",
      "priority": "high|medium|low",
      "recommendation": "Complete actionable recommendation in one paragraph",
      "reason": "Medical reasoning for this recommendation"
    }
  ],
  "warnings": [
    {
      "severity": "critical|high|medium|low",
      "warning": "Warning message about potential risks or important considerations",
      "action": "Specific action to take regarding this warning"
    }
  ],
  "nextSteps": [
    "Specific action item the patient or provider should take"
  ]
}

Important guidelines:
- Base recommendations only on the provided data
- Be specific and actionable
- Consider drug interactions if multiple medications present
- Flag any concerning lab values or vital signs
- Prioritize patient safety
- Include 3-7 recommendations maximum
- Focus on practical, implementable advice
- Write complete sentences for recommendations, not just titles`

      const recommendationResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: recommendationPrompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2048,
            },
          }),
        },
      )

      if (recommendationResponse.ok) {
        const recommendationData = await recommendationResponse.json()
        const recommendationText = recommendationData.candidates?.[0]?.content?.parts?.[0]?.text || ""

        // Extract JSON from markdown code blocks if present
        const jsonMatch =
          recommendationText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || recommendationText.match(/(\{[\s\S]*\})/)

        if (jsonMatch) {
          healthRecommendations = JSON.parse(jsonMatch[1])
          console.log("[v0] Health recommendations generated successfully")
        } else {
          console.warn("[v0] Could not extract JSON from recommendation response")
        }
      } else {
        console.warn("[v0] Health recommendation generation failed:", recommendationResponse.statusText)
      }
    } catch (error) {
      console.error("[v0] Error generating health recommendations:", error)
      // Continue without recommendations if generation fails
    }

    const parsed_fields = [
      { label: "Patient Name", value: structuredData.patient.name },
      { label: "Document Type", value: structuredData.document.type },
      { label: "Hospital", value: structuredData.hospital.name || "Unknown" },
      { label: "Department", value: structuredData.hospital.department || "Not specified" },
      { label: "Doctor/Consultant", value: structuredData.hospital.doctor || "Not specified" },
      { label: "Report Date", value: structuredData.document.reportDate || "Not provided" },
      { label: "MR Number", value: structuredData.patient.mrNumber || "Not provided" },
      { label: "IP Number", value: structuredData.patient.ipNumber || "Not provided" },
      { label: "Date of Birth", value: structuredData.patient.dateOfBirth || "Not provided" },
      { label: "Age", value: structuredData.patient.age || "Not provided" },
      { label: "Gender", value: structuredData.patient.gender || "Not specified" },
      { label: "Admission Date", value: structuredData.document.admissionDate || "Not provided" },
      { label: "Discharge Date", value: structuredData.document.dischargeDate || "Not provided" },
      { label: "Chief Complaint", value: structuredData.medical.chiefComplaint || "Not provided" },
      { label: "Diagnosis", value: structuredData.medical.diagnosis || "Not provided" },
      { label: "Secondary Diagnoses", value: structuredData.medical.secondaryDiagnoses.join("; ") || "None listed" },
      {
        label: "Procedures",
        value:
          structuredData.medical.procedures.map((proc) => `${proc.name} (${proc.date})`).join("; ") || "None listed",
      },
      {
        label: "Medications",
        value:
          structuredData.medical.medications.map((med) => `${med.name} (${med.dosage})`).join("; ") || "None listed",
      },
      {
        label: "Lab Results",
        value:
          structuredData.medical.labResults
            .map((result) => `${result.test}: ${result.measuredValue} (${result.unit})`)
            .join("; ") || "None listed",
      },
      {
        label: "Vital Signs",
        value:
          structuredData.medical.vitalSigns.map((vital) => `${vital.key}: ${vital.value}`).join("; ") || "None listed",
      },
      { label: "Allergies", value: structuredData.medical.allergies.join(", ") || "None listed" },
      { label: "Medical History", value: structuredData.medical.medicalHistory || "Not provided" },
      { label: "Family History", value: structuredData.medical.familyHistory || "Not provided" },
      { label: "Dietary Advice", value: structuredData.treatment.dietaryAdvice.join("; ") || "Not provided" },
      {
        label: "Activity Restrictions",
        value: structuredData.treatment.activityRestrictions.join("; ") || "Not provided",
      },
      {
        label: "Follow-up Instructions",
        value: structuredData.treatment.followUpInstructions.join("; ") || "Not provided",
      },
      { label: "Follow-up Date", value: structuredData.treatment.followUpDate || "Not provided" },
      {
        label: "Special Instructions",
        value: structuredData.treatment.specialInstructions.join("; ") || "Not provided",
      },
      { label: "Total Bill Amount", value: structuredData.billing.totalAmount || "Not provided" },
      { label: "Consultation Fee", value: structuredData.billing.consultationFee || "Not provided" },
      { label: "Room Charges", value: structuredData.billing.roomCharges || "Not provided" },
      {
        label: "Procedure Costs",
        value:
          structuredData.billing.procedureCosts.map((cost) => `${cost.procedure}: ${cost.cost}`).join("; ") ||
          "Not provided",
      },
      {
        label: "Medication Costs",
        value:
          structuredData.billing.medicationCosts.map((cost) => `${cost.medication}: ${cost.cost}`).join("; ") ||
          "Not provided",
      },
      {
        label: "Lab Test Costs",
        value:
          structuredData.billing.labTestCosts.map((cost) => `${cost.test}: ${cost.cost}`).join("; ") || "Not provided",
      },
      {
        label: "Other Charges",
        value:
          structuredData.billing.otherCharges.map((charge) => `${charge.description}: ${charge.amount}`).join("; ") ||
          "Not provided",
      },
      { label: "Subtotal", value: structuredData.billing.subtotal || "Not provided" },
      { label: "Discount", value: structuredData.billing.discount || "Not provided" },
      { label: "Tax Amount", value: structuredData.billing.taxAmount || "Not provided" },
      { label: "Insurance Covered", value: structuredData.billing.insuranceCovered || "Not provided" },
      { label: "Patient Payable", value: structuredData.billing.patientPayable || "Not provided" },
      { label: "Payment Status", value: structuredData.billing.paymentStatus || "Not provided" },
      { label: "Payment Method", value: structuredData.billing.paymentMethod || "Not provided" },
      { label: "Invoice Number", value: structuredData.billing.invoiceNumber || "Not provided" },
      { label: "Receipt Number", value: structuredData.billing.receiptNumber || "Not provided" },
      {
        label: "Imaging Studies",
        value:
          structuredData.imaging.imagingStudies.map((study) => `${study.type} (${study.bodyPart})`).join("; ") ||
          "None listed",
      },
      {
        label: "Pathology Reports",
        value:
          structuredData.imaging.pathologyReports.map((report) => `${report.test} (${report.specimen})`).join("; ") ||
          "None listed",
      },
      ...structuredData.additionalFields,
    ]

    console.log("[v0] Saving document to database with dynamic schema...")

    const overallConfidence =
      pageConfidenceScores.length > 0
        ? Math.round(pageConfidenceScores.reduce((sum, score) => sum + score, 0) / pageConfidenceScores.length)
        : 0

    console.log(`[v0] Overall document confidence score: ${overallConfidence}%`)
    console.log(`[v0] Page confidence scores:`, pageConfidenceScores)

    let document
    let dbError

    // First attempt: with confidence_score
    const insertResult = await supabase
      .from("documents")
      .insert({
        user_name: structuredData.patient.name,
        file_name: originalFileName,
        file_size: files.reduce((sum, f) => sum + f.size, 0),
        file_url: uploadedImageUrls[0],
        document_type: structuredData.document.type,
        parsed_fields,
        structured_data: structuredData,
        confidence_score: overallConfidence,
        health_recommendations: healthRecommendations, // Add health recommendations
      })
      .select()
      .single()

    document = insertResult.data
    dbError = insertResult.error

    // If error is about missing confidence_score column, retry without it
    if (dbError && dbError.message.includes("confidence_score")) {
      console.warn("[v0] ⚠️  confidence_score column not found, inserting without it")
      console.warn("[v0] ⚠️  Run the SQL migration script 008_add_confidence_score.sql to enable confidence scoring")

      const retryResult = await supabase
        .from("documents")
        .insert({
          user_name: structuredData.patient.name,
          file_name: originalFileName,
          file_size: files.reduce((sum, f) => sum + f.size, 0),
          file_url: uploadedImageUrls[0],
          document_type: structuredData.document.type,
          parsed_fields,
          structured_data: structuredData,
          health_recommendations: healthRecommendations, // Add health recommendations in retry too
        })
        .select()
        .single()

      document = retryResult.data
      dbError = retryResult.error
    }

    if (dbError) {
      console.error("[v0] Database error:", dbError.message)
      return NextResponse.json({ error: `Database error: ${dbError.message}` }, { status: 500 })
    }

    console.log("[v0] SUCCESS! Document saved with ID:", document.id)
    console.log("[v0] Total pages processed:", files.length)
    console.log("[v0] All image URLs:", uploadedImageUrls)

    return NextResponse.json({
      id: document.id,
      pagesProcessed: files.length,
      imageUrls: uploadedImageUrls,
      confidenceScore: overallConfidence,
    })
  } catch (error) {
    console.error("[v0] FATAL ERROR:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "No document ID provided" }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: document, error } = await supabase
    .from("documents")
    .select(
      "id, user_name, file_name, file_size, file_url, created_at, document_type, parsed_fields, structured_data, health_recommendations",
    )
    .eq("id", id)
    .single()

  if (error || !document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  let confidenceScore = 0
  try {
    const { data: scoreData } = await supabase.from("documents").select("confidence_score").eq("id", id).single()

    if (scoreData && scoreData.confidence_score !== undefined) {
      confidenceScore = scoreData.confidence_score
    }
  } catch (scoreError) {
    // Confidence score column doesn't exist yet, use default value
    console.log("[v0] confidence_score column not available, using default value")
  }

  return NextResponse.json({
    id: document.id,
    fileName: document.file_name,
    fileSize: document.file_size,
    fileUrl: document.file_url,
    uploadedAt: document.created_at,
    documentType: document.document_type,
    fields: document.parsed_fields || [],
    structuredData: document.structured_data || null,
    confidenceScore: confidenceScore,
    healthRecommendations: document.health_recommendations || null,
  })
}
