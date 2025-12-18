import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { AuthProvider } from "@/lib/auth-context"
import "./globals.css"

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-sans",
    display: "swap",
})

export const metadata: Metadata = {
    title: "Yira Medical Record Parser",
    description: "Intelligent OCR & AI-powered record analysis",
    generator: "v0.app",
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en" className={inter.variable}>
            <body className="font-sans antialiased">
                <AuthProvider>
                    <Suspense fallback={null}>{children}</Suspense>
                </AuthProvider>
                <Analytics />
            </body>
        </html>
    )
}
