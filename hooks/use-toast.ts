// hooks/use-toast.ts
import { useState, useCallback } from "react";

type Toast = {
    id: string;
    title?: string;
    description?: string;
    action?: React.ReactNode;
};

export function useToast() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, "id">) => {
        setToasts((prev) => [
            ...prev,
            { ...toast, id: crypto.randomUUID() }
        ]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return { toasts, addToast, removeToast };
}
