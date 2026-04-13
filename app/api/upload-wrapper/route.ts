import { type NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const externalFormData = new FormData()
        formData.forEach((value, key) => {
            externalFormData.append(key, value)
        })

        const userEmail = req.headers.get('x-user-email') || 'anonymous'
        const userId = req.headers.get('x-user-id') || 'anonymous'
        const userRole = req.headers.get('x-user-role') || 'user'
        const fileName = formData.get('file') instanceof File
            ? (formData.get('file') as File).name
            : 'unknown'
        
        // ✅ Get from environment variables ONLY
        const baseUrl = process.env.YIRA_API_URL
        const appUrl = process.env.NEXT_PUBLIC_APP_URL
        const apiKey = process.env.YIRA_API_KEY

        // ✅ Validate all required env vars exist
        if (!baseUrl || !apiKey || !appUrl) {
            console.error('[UPLOAD] Missing environment variables:', {
                hasYiraUrl: !!baseUrl,
                hasYiraKey: !!apiKey,
                hasAppUrl: !!appUrl,
            })
            return NextResponse.json(
                { error: 'Server configuration error: Missing environment variables' },
                { status: 500 }
            )
        }

        const webhookUrl = `${appUrl}/api/webhook`
        const externalApiUrl = `${baseUrl}?webhook_url=${encodeURIComponent(webhookUrl)}`

        console.log('[UPLOAD] Calling external API:', externalApiUrl)

        const externalResponse = await fetch(externalApiUrl, {
            method: 'POST',
            headers: {
                'X-API-Key': apiKey,
            },
            body: externalFormData,
        })

        if (!externalResponse.ok) {
            const errorText = await externalResponse.text()
            console.error('[UPLOAD] External API error:', {
                status: externalResponse.status,
                statusText: externalResponse.statusText,
                body: errorText,
            })
            
            try {
                const errorData = JSON.parse(errorText)
                return NextResponse.json(
                    { error: errorData.error || 'External upload failed' },
                    { status: externalResponse.status }
                )
            } catch {
                return NextResponse.json(
                    { error: `External API error: ${externalResponse.status} ${externalResponse.statusText}` },
                    { status: externalResponse.status }
                )
            }
        }

        const externalData = await externalResponse.json()
        
        const db = await getDatabase()
        const jobCollection = db.collection('job_ids')
        const usersCollection = db.collection('users')

        let userName = 'anonymous'
        if (userEmail !== 'anonymous') {
            const user = await usersCollection.findOne({ email: userEmail })
            if (user?.name) {
                userName = user.name
            }
        }

        const jobRecord = {
            job_id: externalData.job_id,
            report_id: externalData.report_id,
            tenant_id: externalData.tenant_id,
            project_id: externalData.project_id,
            timestamp: externalData.timestamp,
            user_id: userId,
            user_email: userEmail,
            user_name: userName,
            user_role: userRole,
            file_name: fileName,
            patient_name: null,
            status: 'pending',
            parsed_data: null,
            created_at: new Date(),
            updated_at: new Date(),
        }

        const result = await jobCollection.insertOne(jobRecord)
        console.log('[UPLOAD] Stored job record:', result.insertedId)

        return NextResponse.json({
            ...externalData,
            id: externalData.job_id,
        })
    } catch (error) {
        console.error('[UPLOAD] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}