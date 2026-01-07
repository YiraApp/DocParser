import { type NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const externalFormData = new FormData()

        // Forward files and other fields to external API
        formData.forEach((value, key) => {
            externalFormData.append(key, value)
        })

        // Get user info from headers or session
        const userEmail = req.headers.get('x-user-email') || 'anonymous'
        const userId = req.headers.get('x-user-id') || 'anonymous'
        const userRole = req.headers.get('x-user-role') || 'user'
        const fileName = formData.get('file') instanceof File 
            ? (formData.get('file') as File).name 
            : 'unknown'

        const externalApiUrl = 'https://api.yira.ai/v1/tenants/testing-id-1-1ae6/projects/bd760a58-2d44-4089-b471-cc046ea0a70d/reports?webhook_url=https://yirahealthcampapidev.azurewebsites.net/api/Account/webhooktest'

        const externalResponse = await fetch(externalApiUrl, {
            method: 'POST',
            headers: {
                'X-API-Key': 'sk_testing-id-1-1ae6_yGFKm0V8UDvI8a1TYB9P08-nil7ZZBtU',
            },
            body: externalFormData,
        })

        if (!externalResponse.ok) {
            const errorData = await externalResponse.json()
            return NextResponse.json(
                { error: errorData.error || 'External upload failed' },
                { status: externalResponse.status }
            )
        }

        const externalData = await externalResponse.json()

        // Connect to MongoDB and store job_id with user info
        const db = await getDatabase()
        const jobCollection = db.collection('job_ids')
        
        const jobRecord = {
            job_id: externalData.job_id,
            report_id: externalData.report_id,
            tenant_id: externalData.tenant_id,
            project_id: externalData.project_id,
            timestamp: externalData.timestamp,
            user_id: userId,
            user_email: userEmail,
            user_role: userRole,
            file_name: fileName,
            status: 'pending',
            parsed_data: null,
            created_at: new Date(),
            updated_at: new Date(),
        }

        const result = await jobCollection.insertOne(jobRecord)

        console.log('[UPLOAD] Stored job record:', result.insertedId)

        // Return the external response data
        return NextResponse.json({
            ...externalData,
            id: result.insertedId.toString(),
        })

    } catch (error) {
        console.error('[UPLOAD] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}