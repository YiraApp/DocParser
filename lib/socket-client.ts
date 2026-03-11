import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

export function initializeSocket(): Socket {
    // Return existing connected socket
    if (socketInstance?.connected) {
        console.log("[SOCKET-CLIENT] ✅ Using existing connection:", socketInstance.id);
        return socketInstance;
    }

    // If socket exists but not connected, return it (will reconnect automatically)
    if (socketInstance) {
        console.log("[SOCKET-CLIENT] ⏳ Socket exists but not connected, returning for auto-reconnect");
        return socketInstance;
    }

    try {
        console.log("[SOCKET-CLIENT] 🔌 Creating new Socket.IO connection");

        // Let Socket.IO auto-detect the URL and protocol
        socketInstance = io({
            path: "/socket.io",
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 10,
            transports: ["websocket", "polling"],
            forceNew: false,
        });

        socketInstance.on("connect", () => {
            console.log("[SOCKET-CLIENT] ✅ Connected to Socket.IO server:", socketInstance?.id);
        });

        socketInstance.on("disconnect", (reason: string) => {
            console.log("[SOCKET-CLIENT] 🔌 Disconnected:", reason);
        });

        socketInstance.on("connect_error", (error: any) => {
            console.error("[SOCKET-CLIENT] ❌ Connection error:", error);
        });

        socketInstance.on("error", (error: any) => {
            console.error("[SOCKET-CLIENT] ❌ Socket error:", error);
        });

        return socketInstance;
    } catch (err) {
        console.error("[SOCKET-CLIENT] ❌ Failed to initialize:", err);
        throw err;
    }
}

export function getSocket(): Socket | null {
    return socketInstance;
}

export function disconnectSocket(): void {
    if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
    }
}

export function isSocketConnected(): boolean {
    return socketInstance?.connected ?? false;
}