// auth-context.tsx
"use client";
import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface User {
    id: string;
    email: string;
    role: "admin" | "user";
    uploadCount: number;
}

interface AuthContextType {
    user: User | null;
    login: (email: string, password: string, role: "admin" | "user") => Promise<{ success: boolean, error?: string }>;
    logout: () => Promise<void>;
    incrementUploadCount: () => Promise<void>;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const router = useRouter();

    // Load user from cookie on mount (client-side)
    useEffect(() => {
        const cookie = document.cookie.split('; ').find(row => row.startsWith('yira_session='));
        if (cookie) {
            try {
                const value = cookie.split('=')[1];
                setUser(JSON.parse(decodeURIComponent(value)));
            } catch (e) {
                console.error("[Auth] Failed to parse cookie:", e);
            }
        }
    }, []);

    const login = async (email: string, password: string, role: "admin" | "user"): Promise<{ success: boolean, error?: string }> => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role }),
            });
            const data = await res.json();
            if (!res.ok) {
                return { success: false, error: data.error };
            }
            if (data.success) {
                // Set user directly from response instead of reading cookie
                setUser({
                    id: data.user.id || "",
                    email: data.user.email,
                    role: data.user.role || "user",
                    uploadCount: data.user.uploadCount || 0,
                });
                return { success: true };
            }
            return { success: false, error: data.error || 'Login failed' };
        } catch (err) {
            console.error("[Login] Error:", err);
            return { success: false, error: 'Login failed' };
        }
    };

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        setUser(null);
        router.push('/login');
    };

    const incrementUploadCount = async () => {
        try {
            const res = await fetch('/api/auth/increment-upload', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                if (data.success && user) {
                    setUser({ ...user, uploadCount: data.uploadCount });
                }
            }
        } catch (err) {
            console.error("[Increment Upload] Error:", err);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                login,
                logout,
                incrementUploadCount,
                isAdmin: user?.role === "admin" ?? false,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}