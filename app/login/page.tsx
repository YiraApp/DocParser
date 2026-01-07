// Modified LoginPage.tsx
"use client";
import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, Shield, User, Lock, Mail, LogOut, Eye, EyeOff } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [selectedRole, setSelectedRole] = useState<"admin" | "user">("user");
    const [isSignupMode, setIsSignupMode] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSigningUp, setIsSigningUp] = useState(false);
    const { login, logout, user } = useAuth();
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);
        try {
            const result = await login(email, password, selectedRole); // Pass selectedRole to login
            if (result.success) {
                router.push("/");
            } else {
                setError(result.error || "Invalid credentials");
            }
        } catch (err) {
            setError("Login failed. Try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }
        setIsSigningUp(true);
        try {
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, role: selectedRole }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to create account");
                return;
            }
            setError("");
            setEmail("");
            setPassword("");
            setConfirmPassword("");
            setIsSignupMode(false);
            alert("Account created successfully! Please login.");
        } catch (err) {
            setError("Signup failed. Try again.");
        } finally {
            setIsSigningUp(false);
        }
    };

    const handleLogout = async () => {
        await logout();
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
            <Card className="w-full max-w-[380px] border-slate-200 shadow-sm bg-white">
                <div className="p-6 space-y-5">
                    {/* Header with Logout Button */}
                    <div className="flex items-center justify-between">
                        <div className="text-center space-y-1 flex-1">
                            <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100">
                                <Image src="/yiralogo.png" alt="Yira" width={32} height={32} className="object-contain" />
                            </div>
                            <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
                                {isSignupMode ? "Create Account" : "Welcome Back"}
                            </h1>
                            <p className="text-xs text-slate-500">
                                {isSignupMode ? "Sign up to Yira MedSense" : "Sign in to Yira MedSense"}
                            </p>
                        </div>
                        {user && (
                            <button
                                onClick={handleLogout}
                                className="p-2 hover:bg-red-50 rounded-lg transition"
                                title="Logout"
                            >
                                <LogOut className="w-5 h-5 text-red-500" />
                            </button>
                        )}
                    </div>
                    {/* Role Selection - Always Show */}
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-700">Account Type</Label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedRole("user")}
                                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition flex items-center justify-center gap-2 ${selectedRole === "user"
                                        ? "bg-blue-50 border-blue-300 text-blue-700"
                                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                                    }`}
                            >
                                <User className="w-4 h-4" />
                                User
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedRole("admin")}
                                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition flex items-center justify-center gap-2 ${selectedRole === "admin"
                                        ? "bg-blue-50 border-blue-300 text-blue-700"
                                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                                    }`}
                            >
                                <Shield className="w-4 h-4" />
                                Admin
                            </button>
                        </div>
                    </div>
                    {/* Form */}
                    <form onSubmit={isSignupMode ? handleSignup : handleLogin} className="space-y-3.5">
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-xs font-medium text-slate-700">
                                Email
                            </Label>
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
                            <Label htmlFor="password" className="text-xs font-medium text-slate-700">Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password"
                                    className="pl-9 pr-9 h-9 text-sm border-slate-200 focus:ring-1"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                        <Eye className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            </div>
                        </div>
                        {/* Confirm Password - Only for Signup */}
                        {isSignupMode && (
                            <div className="space-y-1.5">
                                <Label htmlFor="confirmPassword" className="text-xs font-medium text-slate-700">Confirm Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                    <Input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="Confirm Password"
                                        className="pl-9 pr-9 h-9 text-sm border-slate-200 focus:ring-1"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition"
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff className="w-3.5 h-3.5" />
                                        ) : (
                                            <Eye className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                        {error && (
                            <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-100 rounded text-[11px] text-red-600">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                {error}
                            </div>
                        )}
                        <Button type="submit" className="w-full h-9 mt-2 text-sm font-medium" disabled={isLoading || isSigningUp}>
                            {isLoading || isSigningUp ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                isSignupMode ? "Sign Up" : "Sign In"
                            )}
                        </Button>
                        {/* Toggle between Login and Signup */}
                        <button
                            type="button"
                            onClick={() => {
                                setIsSignupMode(!isSignupMode);
                                setError("");
                                setPassword("");
                                setConfirmPassword("");
                            }}
                            className="w-full text-xs text-slate-600 hover:text-blue-600 transition"
                        >
                        </button>
                    </form>
                </div>
            </Card>
        </div>
    );
}