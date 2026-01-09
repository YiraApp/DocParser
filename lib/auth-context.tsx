// auth-context.tsx
"use client";
import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface User {
    id: string;
    email: string;
    name: string;
    phoneNumber: string;
    role: "admin" | "user";
    uploadCount: number;
}

interface AuthContextType {
    user: User | null;
    login: (email: string, password: string, role: "admin" | "user") => Promise<{ success: boolean, error?: string }>;
    logout: () => Promise<void>;
    incrementUploadCount: () => Promise<void>;
    isAdmin: boolean;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    // Initialize auth state on mount
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                // Check server-side session first via /api/auth/me
                const res = await fetch('/api/auth/me', {
                    credentials: 'include',
                    cache: 'no-store'
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.user) {
                        setUser({
                            id: data.user.id,
                            email: data.user.email,
                            name: data.user.name,
                            phoneNumber: data.user.phoneNumber,
                            role: data.user.role,
                            uploadCount: data.user.uploadCount || 0,
                        });
                        setIsLoading(false);
                        return;
                    }
                }
            } catch (err) {
                console.error("[Auth] Failed to fetch session:", err);
            }

            // Fallback: try reading from client-side cookie
            try {
                const cookie = document.cookie.split('; ').find(row => row.startsWith('yira_session='));
                if (cookie) {
                    const value = cookie.split('=')[1];
                    const userData = JSON.parse(decodeURIComponent(value));
                    setUser(userData);
                    setIsLoading(false);
                    return;
                }
            } catch (e) {
                console.error("[Auth] Failed to parse cookie:", e);
            }

            setIsLoading(false);
        };

        initializeAuth();
    }, []);

    // Update the login function to ensure role is properly set
    const login = async (email: string, password: string, role: "admin" | "user"): Promise<{ success: boolean, error?: string }> => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role }),
                credentials: 'include',
            });
            const data = await res.json();

            if (!res.ok) {
                return { success: false, error: data.error };
            }

            if (data.success) {
                const userData: User = {
                    id: data.user.id || "",
                    email: data.user.email,
                    name: data.user.name || "",
                    phoneNumber: data.user.phoneNumber || "",
                    role: data.user.role || "user", // Ensure role from server
                    uploadCount: data.user.uploadCount || 0,
                };
                setUser(userData);
                console.log("[Auth] Login successful, role:", userData.role); // Debug log
                return { success: true };
            }

            return { success: false, error: data.error || 'Login failed' };
        } catch (err) {
            console.error("[Login] Error:", err);
            return { success: false, error: 'Login failed' };
        }
    };

    const logout = async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (err) {
            console.error("[Logout] Error:", err);
        }
        setUser(null);
        router.push('/login');
    };

    const incrementUploadCount = async () => {
        try {
            const res = await fetch('/api/auth/increment-upload', {
                method: 'POST',
                credentials: 'include'
            })
            if (res.ok) {
                const data = await res.json()
                if (data.success && user) {
                    const updatedUser = { ...user, uploadCount: data.uploadCount }
                    setUser(updatedUser)

                    try {
                        const meRes = await fetch('/api/auth/me', {
                            credentials: 'include',
                            cache: 'no-store'
                        })
                        if (meRes.ok) {
                            const meData = await meRes.json()
                            if (meData.success && meData.user) {
                                setUser({
                                    id: meData.user.id,
                                    email: meData.user.email,
                                    name: meData.user.name,
                                    phoneNumber: meData.user.phoneNumber,
                                    role: meData.user.role,
                                    uploadCount: meData.user.uploadCount || 0,
                                })
                            }
                        }
                    } catch (err) {
                        console.warn("[Auth] Could not refresh from /me endpoint:", err)
                    }
                }
            }
        } catch (err) {
            console.error("[Increment Upload] Error:", err)
        }
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                login,
                logout,
                incrementUploadCount,
                isAdmin: user?.role === "admin" ?? false,
                isLoading,
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