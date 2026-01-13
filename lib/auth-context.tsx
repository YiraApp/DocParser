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
                console.log("[Auth] Initializing auth state...");
                
                // Always check server-side session via /api/auth/me
                // httpOnly cookies cannot be read from JavaScript, so we need the server to verify
                const res = await fetch('/api/auth/me', {
                    credentials: 'include', // Important: send cookies with request
                    cache: 'no-store',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                    }
                });

                console.log("[Auth] /api/auth/me response status:", res.status);

                if (res.ok) {
                    const data = await res.json();
                    console.log("[Auth] Session valid for user:", data.user?.email);
                    
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
                } else {
                    console.warn("[Auth] /api/auth/me returned status:", res.status);
                }
            } catch (err) {
                console.error("[Auth] Failed to fetch session:", err);
            }

            // If we reach here, no valid session
            console.log("[Auth] No valid session found");
            setIsLoading(false);
        };

        initializeAuth();
    }, []);

    const login = async (email: string, password: string, role: "admin" | "user"): Promise<{ success: boolean, error?: string }> => {
        try {
            console.log("[Auth] Login attempt for:", email);
            
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role }),
                credentials: 'include', // Important: receive and store cookies
            });
            const data = await res.json();

            if (!res.ok) {
                console.error("[Auth] Login failed:", data.error);
                return { success: false, error: data.error };
            }

            if (data.success) {
                const userData: User = {
                    id: data.user.id || "",
                    email: data.user.email,
                    name: data.user.name || "",
                    phoneNumber: data.user.phoneNumber || "",
                    role: data.user.role || "user",
                    uploadCount: data.user.uploadCount || 0,
                };
                setUser(userData);
                console.log("[Auth] Login successful, role:", userData.role);
                
                // Give the browser a moment to process the cookie before navigating
                await new Promise(resolve => setTimeout(resolve, 100));
                
                return { success: true };
            }

            return { success: false, error: data.error || 'Login failed' };
        } catch (err) {
            console.error("[Auth] Login error:", err);
            return { success: false, error: 'Login failed' };
        }
    };

    const logout = async () => {
        try {
            console.log("[Auth] Logout initiated");
            const res = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
            console.log("[Auth] Logout response status:", res.status);
        } catch (err) {
            console.error("[Auth] Logout error:", err);
        }
        
        setUser(null);
        
        // Give the browser a moment to clear the cookie
        await new Promise(resolve => setTimeout(resolve, 100));
        
        router.replace('/login');
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
                    setUser({ ...user, uploadCount: data.uploadCount })

                    // Refresh user data from server
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
            console.error("[Auth] Increment upload error:", err)
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