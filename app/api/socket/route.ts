import { NextRequest, NextResponse } from "next/server"

// This endpoint is not needed with custom server
// Socket.IO is handled by server.ts with custom Node.js server
// Keep this file for reference only

export async function GET(request: NextRequest) {
    return NextResponse.json(
        { message: "Socket.IO server is running on custom Node.js server" },
        { status: 200 }
    )
}