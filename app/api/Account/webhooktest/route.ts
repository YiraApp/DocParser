// app/api/Account/webhooktest/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { ObjectId } from 'mongodb'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        console.log('[WEBHOOK-ACCOUNT] Received payload with job_id:', body.job_id)

        // Validate required fields
        if (!body.job_id) {
            console.error('[WEBHOOK-ACCOUNT] Missing job_id')
            return NextResponse.json(
                { error: 'Missing required field: job_id' },
                { status: 400 }
            )
        }

        const db = await getDatabase()
        const jobCollection = db.collection('job_ids')
        const documentsCollection = db.collection('documents')

        // Extract document name from parsed_data (patient name or fallback to existing file_name)
        const documentName = body.parsed_data?.patient_name || 
                            body.parsed_data?.encounter_date || 
                            'Medical Document'

        const updateData = {
            $set: {
                parsed_data: body.parsed_data || null,
                structured_data: body.parsed_data || null,
                fraud_detection: body.fraud_detection || null,
                status: body.status || 'completed',
                document_type: 'Medical Report',
                file_name: documentName, // Store document name for display
                updated_at: new Date(),
                processed: true,
            }
        }

        // Update in job_ids collection
        const jobUpdateResult = await jobCollection.updateOne(
            { job_id: body.job_id },
            updateData
        )

        console.log('[WEBHOOK-ACCOUNT] Job matched:', jobUpdateResult.matchedCount)
        console.log('[WEBHOOK-ACCOUNT] Job modified:', jobUpdateResult.modifiedCount)
        console.log('[WEBHOOK-ACCOUNT] Document name:', documentName)

        // Also try to update documents collection by job_id if it exists
        if (jobUpdateResult.matchedCount > 0) {
            await documentsCollection.updateMany(
                { job_id: body.job_id },
                updateData
            ).catch(err => {
                console.log('[WEBHOOK-ACCOUNT] No matching documents in documents collection:', err.message)
            })
        }

        if (jobUpdateResult.matchedCount === 0) {
            console.warn('[WEBHOOK-ACCOUNT] No matching job found for job_id:', body.job_id)
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            )
        }

        console.log('[WEBHOOK-ACCOUNT] Successfully updated job_id:', body.job_id)
        
        return NextResponse.json({ 
            success: true,
            file_name: documentName
        })
    } catch (error) {
        console.error('[WEBHOOK-ACCOUNT] Error processing webhook:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}