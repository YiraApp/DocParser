import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        return NextResponse.json({
            success: true,
            data: body,
        });
    } catch (error) {
        return NextResponse.json(
            { success: false, message: "Error processing request" },
            { status: 500 }
        );
    }
}
