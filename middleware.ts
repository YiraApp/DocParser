import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
    // Get session cookie
    const sessionCookie = request.cookies.get("yira_session")?.value

    if (!sessionCookie) {
        // No session, redirect to login if trying to access admin
        if (request.nextUrl.pathname.startsWith("/admin")) {
            return NextResponse.redirect(new URL("/login", request.url))
        }
        return NextResponse.next()
    }

    try {
        const session = JSON.parse(sessionCookie)

        // Check if user is admin trying to access admin page
        if (request.nextUrl.pathname.startsWith("/admin")) {
            if (session.role !== "admin") {
                return NextResponse.redirect(new URL("/", request.url))
            }
        }
    } catch (error) {
        console.error("[MIDDLEWARE] Error parsing session:", error)
        if (request.nextUrl.pathname.startsWith("/admin")) {
            return NextResponse.redirect(new URL("/login", request.url))
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/admin/:path*", "/"],
}