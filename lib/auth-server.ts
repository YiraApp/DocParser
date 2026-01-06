import { type NextRequest } from "next/server"

export type SessionUser = {
    email: string
    isAdmin: boolean
}

export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
    const cookie = req.cookies.get("yira_session")?.value
    if (!cookie) {
        return null
    }
    try {
        const userData = JSON.parse(cookie) as {
            id: string
            email: string
            role: "admin" | "user"
            uploadCount: number
        }
        return {
            email: userData.email,
            isAdmin: userData.role === "admin",
        }
    } catch (error) {
        console.error("[Auth] Failed to parse session cookie:", error)
        return null
    }
}