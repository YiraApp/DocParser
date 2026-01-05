"use client"
import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { NextRequest } from "next/server"
interface User {
    id: string
    email: string
    role: "admin" | "user"
    uploadCount: number
}
interface AuthContextType {
    user: User | null
    login: (email: string, password: string) => Promise<boolean>
    logout: () => void
    incrementUploadCount: () => void
    isAdmin: boolean
}
const AuthContext = createContext<AuthContextType | undefined>(undefined)
const MOCK_USERS = {
    admin: { email: "admin@yira.ai", password: "admin123", role: "admin" as const },
    user: { email: "yirause@yira.ai", password: "user123", role: "user" as const },
}
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [isHydrated, setIsHydrated] = useState(false)
    // Load user from localStorage on mount (client-side only)
    useEffect(() => {
        const storedUser = localStorage.getItem("yira_user")
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser))
            } catch (e) {
                console.error("[Auth] Failed to parse stored user:", e)
            }
        }
        setIsHydrated(true)
    }, [])
    const login = async (email: string, password: string): Promise<boolean> => {
        // Check credentials
        const matchedUser = Object.entries(MOCK_USERS).find(
            ([_, data]) => data.email === email && data.password === password,
        )
        if (matchedUser) {
            const [_, userData] = matchedUser

            // Check if we have stored upload count for this user
            const storedUploadCount = localStorage.getItem(`yira_uploadCount_${userData.email}`)
            let uploadCount = 0

            if (storedUploadCount) {
                uploadCount = parseInt(storedUploadCount, 10) || 0
            } else {
                // Try to get from existing user data
                const existingUser = localStorage.getItem("yira_user")
                if (existingUser) {
                    try {
                        const parsed = JSON.parse(existingUser)
                        if (parsed.email === email) {
                            uploadCount = parsed.uploadCount || 0
                        }
                    } catch (e) {
                        console.error("[Auth] Failed to parse existing user:", e)
                    }
                }
            }
            const newUser: User = {
                id: Math.random().toString(36).substr(2, 9),
                email: userData.email,
                role: userData.role,
                uploadCount: uploadCount,
            }
            setUser(newUser)
            localStorage.setItem("yira_user", JSON.stringify(newUser))
            localStorage.setItem(`yira_uploadCount_${userData.email}`, String(uploadCount))

            // Set session cookie for server-side access (expires in 7 days)
            document.cookie = `yira_session=${JSON.stringify(newUser)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict; Secure`;

            return true
        }
        return false
    }
    const logout = () => {
        setUser(null)
        localStorage.removeItem("yira_user")
        // Clear session cookie
        document.cookie = "yira_session=; path=/; max-age=0; SameSite=Strict; Secure";
    }
    const incrementUploadCount = () => {
        if (user) {
            const updatedUser = { ...user, uploadCount: user.uploadCount + 1 }
            setUser(updatedUser)
            localStorage.setItem("yira_user", JSON.stringify(updatedUser))
            // Also store separately by email so it persists across logout/login
            localStorage.setItem(`yira_uploadCount_${user.email}`, String(updatedUser.uploadCount))
            // Update cookie
            document.cookie = `yira_session=${JSON.stringify(updatedUser)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict; Secure`;
        }
    }
    return (
        <AuthContext.Provider
            value={{
                user,
                login,
                logout,
                incrementUploadCount,
                isAdmin: user?.role === "admin",
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}
export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}

/* ✅ SessionUser type (re-export for server use) */
export type SessionUser = {
    email: string;
    isAdmin: boolean;
};

export const getSessionUser = async (req: NextRequest): Promise<SessionUser | null> => {
    const cookie = req.cookies.get("yira_session")?.value;
    if (!cookie) {
        return null;
    }
    try {
        const userData = JSON.parse(cookie) as {
            id: string;
            email: string;
            role: "admin" | "user";
            uploadCount: number;
        };
        return {
            email: userData.email,
            isAdmin: userData.role === "admin",
        };
    } catch (error) {
        console.error("[Auth] Failed to parse session cookie:", error);
        return null;
    }
};