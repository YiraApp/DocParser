import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: documents, error } = await supabase
      .from("documents")
      .select("structured_data, document_type, created_at")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Metrics fetch error:", error)
      return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 })
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({
        totalRecords: 0,
        recordsWithData: 0,
        documentTypes: {},
        topHospitals: [],
        topDiagnoses: [],
        topMedications: [],
        topProcedures: [],
        genderDistribution: { Male: 0, Female: 0, Other: 0, Unknown: 0 },
        ageDistribution: { "0-17": 0, "18-30": 0, "31-45": 0, "46-60": 0, "61+": 0, Unknown: 0 },
        processingTrends: { last7Days: 0, last30Days: 0, last90Days: 0 },
        averageFieldsExtracted: 0,
      })
    }

    const documentTypes: Record<string, number> = {}
    const hospitals: Record<string, number> = {}
    const diagnoses: Record<string, number> = {}
    const medications: Record<string, number> = {}
    const procedures: Record<string, number> = {}
    const genderDistribution = { Male: 0, Female: 0, Other: 0, Unknown: 0 }
    const ageDistribution = { "0-17": 0, "18-30": 0, "31-45": 0, "46-60": 0, "61+": 0, Unknown: 0 }

    let recordsWithData = 0
    let totalFieldsExtracted = 0
    const now = new Date()
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    let recordsLast7Days = 0
    let recordsLast30Days = 0
    let recordsLast90Days = 0

    documents.forEach((doc) => {
      const data = doc.structured_data as any
      const createdAt = new Date(doc.created_at)

      // Processing trends
      if (createdAt >= last7Days) recordsLast7Days++
      if (createdAt >= last30Days) recordsLast30Days++
      if (createdAt >= last90Days) recordsLast90Days++

      if (!data || Object.keys(data).length === 0) return

      recordsWithData++

      // Count total fields extracted
      const countFields = (obj: any): number => {
        let count = 0
        for (const key in obj) {
          if (obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
            count += countFields(obj[key])
          } else if (obj[key]) {
            count++
          }
        }
        return count
      }
      totalFieldsExtracted += countFields(data)

      // Document type distribution
      const docType = doc.document_type || data.documentType || "Unknown"
      documentTypes[docType] = (documentTypes[docType] || 0) + 1

      // Hospital/Provider analysis
      const hospital = data.hospital || data.Hospital || data.hospitalDetails?.name || data.provider
      if (hospital && typeof hospital === "string") {
        hospitals[hospital] = (hospitals[hospital] || 0) + 1
      }

      // Diagnosis tracking
      const diagnosis = data.diagnosis || data.Diagnosis || data.medicalDetails?.diagnosis
      if (diagnosis) {
        diagnoses[diagnosis] = (diagnoses[diagnosis] || 0) + 1
      }

      // Medication analysis
      const medication = data.medications || data.Medications || data.medicalDetails?.medications
      if (medication && Array.isArray(medication)) {
        medication.forEach((med) => {
          medications[med] = (medications[med] || 0) + 1
        })
      }

      // Procedure analysis
      const procedure = data.procedures || data.Procedures || data.medicalDetails?.procedures
      if (procedure && Array.isArray(procedure)) {
        procedure.forEach((proc) => {
          procedures[proc] = (procedures[proc] || 0) + 1
        })
      }

      // Gender distribution
      const gender = data.gender || data.Gender || "Unknown"
      if (gender === "Male") genderDistribution.Male++
      else if (gender === "Female") genderDistribution.Female++
      else if (gender === "Other") genderDistribution.Other++
      else genderDistribution.Unknown++

      // Age distribution
      const age = data.age || data.Age || "Unknown"
      if (age === "0-17") ageDistribution["0-17"]++
      else if (age === "18-30") ageDistribution["18-30"]++
      else if (age === "31-45") ageDistribution["31-45"]++
      else if (age === "46-60") ageDistribution["46-60"]++
      else if (age === "61+") ageDistribution["61+"]++
      else ageDistribution.Unknown++
    })

    // Prepare top lists
    const topHospitals = Object.entries(hospitals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
    const topDiagnoses = Object.entries(diagnoses)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
    const topMedications = Object.entries(medications)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
    const topProcedures = Object.entries(procedures)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    // Calculate average fields extracted
    const averageFieldsExtracted = recordsWithData > 0 ? totalFieldsExtracted / recordsWithData : 0

    return NextResponse.json({
      totalRecords: documents.length,
      recordsWithData,
      documentTypes,
      topHospitals,
      topDiagnoses,
      topMedications,
      topProcedures,
      genderDistribution,
      ageDistribution,
      processingTrends: { last7Days: recordsLast7Days, last30Days: recordsLast30Days, last90Days: recordsLast90Days },
      averageFieldsExtracted: Math.round(averageFieldsExtracted),
    })
  } catch (error) {
    console.error("[v0] Metrics calculation error:", error)
    return NextResponse.json({ error: "Failed to calculate metrics" }, { status: 500 })
  }
}
