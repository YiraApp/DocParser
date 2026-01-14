import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { ObjectId } from "mongodb"
import * as pdf from "pdf-parse"
import fs from "fs"
import path from "path"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: NextRequest) {
    try {
        const { documentId, jobId, fileName } = await request.json()

        if (!documentId || !jobId) {
            return NextResponse.json(
                { error: "Missing documentId or jobId" },
                { status: 400 }
            )
        }

        const db = await getDatabase()
        const documentsCollection = db.collection("documents")

        // Find the document
        const document = await documentsCollection.findOne({
            _id: new ObjectId(documentId),
        })

        if (!document) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 })
        }

        // TODO: Retrieve the actual file from storage (S3, local, etc.)
        // For now, assuming the file is already available

        console.log(`[PARSER] Starting parse for document: ${documentId}`)

        // Mock parsing result (replace with actual PDF parsing)
        const parsedData = {
            extracted_text: "Sample extracted text from PDF",
            extracted_fields: {
                patient_name: "John Doe",
                patient_id: "12345",
                encounter_date: new Date().toISOString(),
            },
            structured_output: {
                sections: ["Header", "Body", "Footer"],
                page_count: 1,
            },
            confidence_score: 0.95,
            parsing_timestamp: new Date(),
        }

        // Update document with parsed data
        const updateResult = await documentsCollection.updateOne(
            { _id: new ObjectId(documentId) },
            {
                $set: {
                    parsed_data: parsedData,
                    structured_data: parsedData.extracted_fields,
                    status: "completed",
                    updated_at: new Date(),
                },
            }
        )

        if (updateResult.matchedCount === 0) {
            return NextResponse.json({ error: "Document not found for update" }, { status: 404 })
        }

        console.log(`[PARSER] Successfully parsed document: ${documentId}`)

        return NextResponse.json({
            success: true,
            documentId,
            jobId,
            parsedData,
        })
    } catch (error) {
        console.error("[PARSER] Error:", error)

        // Update document status to failed
        const { documentId } = await request.json()
        if (documentId) {
            const db = await getDatabase()
            await db.collection("documents").updateOne(
                { _id: new ObjectId(documentId) },
                {
                    $set: {
                        status: "failed",
                        error_message: error instanceof Error ? error.message : "Unknown parsing error",
                        updated_at: new Date(),
                    },
                }
            )
        }

        return NextResponse.json(
            { error: "Failed to parse document" },
            { status: 500 }
        )
    }
}