import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
    // This endpoint is for the Socket.IO client to connect
    // The actual Socket.IO server is initialized in pages/api/socket.ts or middleware

    return NextResponse.json(
        { message: "Socket.IO server is running" },
        { status: 200 }
    )
}