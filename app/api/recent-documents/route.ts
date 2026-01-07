import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

interface HistoryDocument {
  id: string;
  file_name: string;
  created_at: string;
  structured_data: any;
  job_id: string;
  report_id: string;
}

export async function GET(request: NextRequest) {
  try {
    const userEmail = request.headers.get("x-user-email");
    const limit = 10;

    if (!userEmail || userEmail === "anonymous") {
      return NextResponse.json({ documents: [] });
    }

    const db = await getDatabase();
    const documentsCollection = db.collection("documents");

    // Fetch recent documents for user
    const documents = await documentsCollection
      .find({ user_email: userEmail, status: "completed" })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();

    // Map to expected format
    const mappedDocuments: HistoryDocument[] = documents.map((doc: any) => ({
      id: doc._id.toString(),
      file_name: doc.file_name || "document",
      created_at: doc.created_at?.toISOString() || new Date().toISOString(),
      structured_data: mapParsedDataToStructuredData(doc.parsed_data),
      job_id: doc.job_id,
      report_id: doc.report_id,
    }));

    return NextResponse.json({ documents: mappedDocuments });
  } catch (error) {
    console.error("[RECENT-DOCUMENTS] Error:", error);
    return NextResponse.json({
      documents: [],
    });
  }
}

// Helper function to map parsed_data to structured_data format
function mapParsedDataToStructuredData(parsedData: any) {
  if (!parsedData) return {};

  return {
    patient_name: parsedData.patient_name,
    patient_id: parsedData.patient_id,
    encounter_date: parsedData.encounter_date,
    clinician_name: parsedData.clinician_name,
    lab_results: parsedData.lab_results || [],
    vitals: parsedData.lab_results?.find(
      (lr: any) => lr.examination_name === "Vitals"
    ),
    diagnosis: parsedData.diagnosis,
    medications: parsedData.medications,
    procedures: parsedData.procedures,
    imaging_findings: parsedData.imaging_findings,
    recommendations: parsedData.recommendations,
  };
}