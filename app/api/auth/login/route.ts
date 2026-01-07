// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { SessionUser } from '@/lib/auth-context'; // adjust path if needed
import bcrypt from 'bcryptjs'; // Import bcryptjs for password hashing/comparison

export async function POST(req: NextRequest) {
    try {
        const { email, password, role } = await req.json(); // Added role to the request body
        if (!email || !password || !role) {
            return NextResponse.json(
                { error: 'Email, password, and role are required' },
                { status: 400 }
            );
        }
        const db = await getDb();
        const user = await db.collection('users').findOne({ email });
        if (!user) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }
        if (!(await bcrypt.compare(password, user.password))) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }
        if (user.role !== role) {
            return NextResponse.json(
                { error: 'Invalid role' },
                { status: 401 }
            );
        }
        // Full session data for cookie and response
        const fullSession = {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
            uploadCount: user.uploadCount ?? 0,
        };
        const response = NextResponse.json({
            success: true,
            user: fullSession,
        });
        response.cookies.set('yira_session', JSON.stringify(fullSession), {
            path: '/',
            maxAge: 7 * 24 * 60 * 60, // 7 days
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
        });
        return response;
    } catch (error) {
        console.error('[Login API] Error:', error);
        return NextResponse.json(
            { error: 'Login failed' },
            { status: 500 }
        );
    }
}