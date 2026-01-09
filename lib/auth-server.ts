import { NextRequest } from "next/server";

export type SessionUser = {
    email: string;
    name: string;
    phoneNumber: string;
    isAdmin: boolean;
};

export const getSessionUser = async (
    req: NextRequest
): Promise<SessionUser | null> => {
    const cookie = req.cookies.get("yira_session")?.value;

    if (!cookie) {
        return null;
    }

    try {
        const userData = JSON.parse(cookie) as {
            id: string;
            email: string;
            name: string;
            phoneNumber: string;
            role: "admin" | "user";
            uploadCount: number;
        };

        return {
            email: userData.email,
            name: userData.name,
            phoneNumber: userData.phoneNumber,
            isAdmin: userData.role === "admin",
        };
    } catch (error) {
        console.error("[Auth] Failed to parse session cookie:", error);
        return null;
    }
};
