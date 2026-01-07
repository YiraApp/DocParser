import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';  // Assuming this is your DB helper
import { getSessionUser } from '@/lib/auth-context';

export async function POST(req: NextRequest) {
    try {
        const session = await getSessionUser(req);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDb();
        const result = await db.collection('users').findOneAndUpdate(
            { email: session.email },
            { $inc: { uploadCount: 1 } },
            { returnDocument: 'after' }
        );

        if (!result?.value) {  // Add null check with optional chaining
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Update session cookie with new uploadCount
        const updatedSession = {
            id: result.value._id.toString(),
            email: result.value.email,
            role: result.value.role,
            uploadCount: result.value.uploadCount,
        };

        const response = NextResponse.json({ success: true, uploadCount: result.value.uploadCount });
        response.cookies.set('yira_session', JSON.stringify(updatedSession), {
            path: '/',
            maxAge: 7 * 24 * 60 * 60,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
        });

        return response;
    } catch (error) {
        console.error('[Increment Upload API] Error:', error);
        return NextResponse.json({ error: 'Failed to increment upload count' }, { status: 500 });
    }
}