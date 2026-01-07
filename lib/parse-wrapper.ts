import { getDatabase } from "@/lib/db"
import { v4 as uuidv4 } from "uuid"

export interface UploadDocumentResult {
  success: boolean
  documentId?: string
  job_id?: string
  report_id?: string
  error?: string
}

/**
 * Uploads a document to Yira for processing
 * @param file - The file to upload
 * @param userEmail - Email of the user uploading
 * @param originalFileName - Original file name
 * @returns Result with document ID and job info
 */
export async function uploadDocumentToYira(
  file: File,
  userEmail: string,
  originalFileName: string,
): Promise<UploadDocumentResult> {
  try {
    const db = await getDatabase()
    const documentsCollection = db.collection("documents")

    // Create document record
    const jobId = uuidv4()
    const reportId = uuidv4()
    const documentId = uuidv4()

    const fileBuffer = await file.arrayBuffer()

    const documentRecord = {
      _id: documentId,
      user_email: userEmail,
      file_name: originalFileName,
      file_type: file.type,
      file_size: file.size,
      status: "processing",
      job_id: jobId,
      report_id: reportId,
      created_at: new Date(),
      updated_at: new Date(),
      parsed_data: null,
      structured_data: null,
      error_message: null,
    }

    await documentsCollection.insertOne(documentRecord)

    console.log("[parse-wrapper] Document created:", documentId)

    return {
      success: true,
      documentId,
      job_id: jobId,
      report_id: reportId,
    }
  } catch (error) {
    console.error("[parse-wrapper] Error uploading document:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload document",
    }
  }
}