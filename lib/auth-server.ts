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

    console.log("[AUTH-SERVER] Checking session cookie:", {
        hasCookie: !!cookie,
        allCookies: req.cookies.getAll().map((c) => c.name),
    });

    if (!cookie) {
        console.warn("[AUTH-SERVER] No session cookie found");
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

        console.log("[AUTH-SERVER] Session valid for user:", userData.email);

        return {
            email: userData.email,
            name: userData.name,
            phoneNumber: userData.phoneNumber,
            isAdmin: userData.role === "admin",
        };
    } catch (error) {
        console.error("[AUTH-SERVER] Failed to parse session cookie:", error);
        return null;
    }
};
