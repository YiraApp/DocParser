// Example Admin Page for Creating Users (app/admin/create-user/page.tsx) - Add this for admin to create accounts
"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

export default function CreateUserPage() {
    const { isAdmin } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<"admin" | "user">("user");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    if (!isAdmin) {
        router.push("/"); // Redirect if not admin
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess(false);

        try {
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, role }),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Failed to create user");
                return;
            }

            setSuccess(true);
            setEmail("");
            setPassword("");
            setRole("user");
        } catch (err) {
            setError("An error occurred");
        }
    };

    return (
        <div className="p-4">
            <h1>Create New User</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div>
                    <Label>Role</Label>
                    <Select value={role} onValueChange={(value: "admin" | "user") => setRole(value)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {error && <p className="text-red-500">{error}</p>}
                {success && <p className="text-green-500">User created successfully</p>}
                <Button type="submit">Create User</Button>
            </form>
        </div>
    );
}