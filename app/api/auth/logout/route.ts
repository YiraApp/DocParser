import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const isSecure = protocol === 'https';
    
    const response = NextResponse.json({ success: true });
    
    response.cookies.set('yira_session', '', {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "strict" : "lax",
        maxAge: 0, // Immediately expire
        path: "/",
    });
    
    console.log('[LOGOUT] Session cleared (secure=' + isSecure + ')');
    
    return response;
}