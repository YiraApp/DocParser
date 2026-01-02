"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Loader2, Shield, User, Lock, Mail } from "lucide-react"
import Image from "next/image"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")
    const [selectedRole, setSelectedRole] = useState<"admin" | "user">("user")
    const { login } = useAuth()
    const router = useRouter()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setIsLoading(true)

        try {
            const success = await login(email, password)
            if (success) {
                router.push("/")
            } else {
                setError("Invalid credentials")
            }
        } catch (err) {
            setError("Login failed. Try again.")
        } finally {
            setIsLoading(false)
        }
    }

    const fillCredentials = (role: "admin" | "user") => {
        setSelectedRole(role)
        if (role === "admin") {
            setEmail("admin@yira.ai")
            setPassword("admin123")
        } else {
            setEmail("yirauser@yira.ai")
            setPassword("user123")
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
            <Card className="w-full max-w-[380px] border-slate-200 shadow-sm bg-white">
                <div className="p-6 space-y-5">
                    {/* Minimalist Header */}
                    <div className="text-center space-y-1">
                        <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100">
                            <Image src="/yiralogo.png" alt="Yira" width={32} height={32} className="object-contain" />
                        </div>
                        <h1 className="text-xl font-semibold text-slate-800 tracking-tight">Welcome Back</h1>
                        <p className="text-xs text-slate-500">Sign in to Yira MedSense</p>
                    </div>

                    {/* Compact Role Selection */}
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            type="button"
                            variant={selectedRole === "user" ? "default" : "outline"}
                            className="h-9 text-xs gap-1.5"
                            onClick={() => fillCredentials("user")}
                        >
                            <User className="w-3.5 h-3.5" />
                            User
                        </Button>
                        <Button
                            type="button"
                            variant={selectedRole === "admin" ? "default" : "outline"}
                            className="h-9 text-xs gap-1.5"
                            onClick={() => fillCredentials("admin")}
                        >
                            <Shield className="w-3.5 h-3.5" />
                            Admin
                        </Button>
                    </div>

                    {/* Form with tighter spacing */}
                    <form onSubmit={handleLogin} className="space-y-3.5">
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-xs font-medium text-slate-700">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="Email"
                                    className="pl-9 h-9 text-sm border-slate-200 focus:ring-1"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="password" title="Password" className="text-xs font-medium text-slate-700">Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Password"
                                    className="pl-9 h-9 text-sm border-slate-200 focus:ring-1"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-100 rounded text-[11px] text-red-600">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full h-9 mt-2 text-sm font-medium" disabled={isLoading}>
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                "Sign In"
                            )}
                        </Button>
                    </form>
                </div>
            </Card>
        </div>
    )
}