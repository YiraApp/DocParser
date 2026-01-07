import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/auth-server';  // <-- Updated import

export async function POST(req: NextRequest) {
    try {
        const { email, password, role } = await req.json();
        // Validate input
        if (!email || !password || !role) {
            return NextResponse.json({ error: 'Email, password, and role are required' }, { status: 400 });
        }
        if (role !== 'admin' && role !== 'user') {
            return NextResponse.json({ error: 'Invalid role. Must be "admin" or "user"' }, { status: 400 });
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }
        // Validate password strength
        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }
        // Check if user is admin for admin account creation
        const session = await getSessionUser(req);
        const isAdminUser = session && session.isAdmin;
        // Only admins can create admin accounts
        if (role === 'admin' && !isAdminUser) {
            return NextResponse.json(
                { error: 'Only admins can create admin accounts' },
                { status: 403 }
            );
        }
        // Connect to database
        const db = await getDb();

        if (!db) {
            throw new Error('Database connection failed');
        }
        const usersCollection = db.collection('users');
        // Check if user already exists
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
            return NextResponse.json({ error: 'User already exists' }, { status: 409 });
        }
        // Hash password
        const hashedPassword = bcrypt.hashSync(password, 10);
        // Insert new user
        const result = await usersCollection.insertOne({
            email,
            password: hashedPassword,
            role,
            uploadCount: 0,
            createdAt: new Date(),
        });
        if (!result.insertedId) {
            throw new Error('Failed to insert user');
        }
        return NextResponse.json(
            {
                success: true,
                userId: result.insertedId.toString(),
                message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('[Signup API] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json(
            { error: 'Signup failed', details: errorMessage },
            { status: 500 }
        );
    }
}