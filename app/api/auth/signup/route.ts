import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import bcrypt from "bcryptjs";

// Validate phone number - 10 digits
function validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phone.replace(/\D/g, ""));
}

export async function POST(request: NextRequest) {
    try {
        const { email, password, name, phoneNumber, role } = await request.json();

        // Validation
        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 }
            );
        }

        if (!name || name.trim().length === 0) {
            return NextResponse.json(
                { error: "Name is required" },
                { status: 400 }
            );
        }

        if (!phoneNumber || !validatePhoneNumber(phoneNumber)) {
            return NextResponse.json(
                { error: "Valid 10-digit phone number is required" },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: "Password must be at least 6 characters" },
                { status: 400 }
            );
        }

        const db = await getDatabase();
        const usersCollection = db.collection("users");

        // Check if user already exists
        const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return NextResponse.json(
                { error: "Email already registered" },
                { status: 409 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user document
        const newUser = {
            email: email.toLowerCase(),
            password: hashedPassword,
            name: name.trim(),
            phoneNumber: phoneNumber.replace(/\D/g, ""),
            role: role || "user",
            uploadCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // Insert user
        const result = await usersCollection.insertOne(newUser);

        return NextResponse.json({
            success: true,
            message: "Account created successfully",
            userId: result.insertedId.toString(),
        });
    } catch (error) {
        console.error("[SIGNUP] Error:", error);
        return NextResponse.json(
            { error: "Failed to create account" },
            { status: 500 }
        );
    }
}