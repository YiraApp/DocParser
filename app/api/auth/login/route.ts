// app/api/auth/login/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
    try {
        const { email, password, role } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password required" },
                { status: 400 }
            );
        }

        const db = await getDatabase();
        const usersCollection = db.collection("users");

        // Find user
        const user = await usersCollection.findOne({ email: email.toLowerCase() });
        if (!user) {
            return NextResponse.json(
                { error: "Invalid credentials" },
                { status: 401 }
            );
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return NextResponse.json(
                { error: "Invalid credentials" },
                { status: 401 }
            );
        }

        // Verify role matches
        if (user.role !== role) {
            return NextResponse.json(
                { error: "Invalid role selection" },
                { status: 401 }
            );
        }

        // Create session cookie
        const sessionData = {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            phoneNumber: user.phoneNumber,
            role: user.role,
            uploadCount: user.uploadCount || 0,
        };

        const response = NextResponse.json({
            success: true,
            user: sessionData,
        });

        // Set session cookie
        response.cookies.set("yira_session", JSON.stringify(sessionData), {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60, // 7 days
        });

        return response;
    } catch (error) {
        console.error("[LOGIN] Error:", error);
        return NextResponse.json(
            { error: "Login failed" },
            { status: 500 }
        );
    }
}