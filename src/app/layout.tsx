import type React from "react"
import type { Metadata } from "next"
// import { Inter } from "next/font/google" 
import "./globals.css"
import { SessionProvider } from '@/components/providers/SessionProvider'
import { ToastProvider } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster";
import SmokeEffect from "@/components/ui/SmokeEffect";

// const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Tarana-ai | Plan Your Perfect Baguio Trip",
  description:
    "We craft your perfect itinerary — personalized to your budget, interests, group size, and real-time traffic conditions.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <SessionProvider>
          <ToastProvider>
            <SmokeEffect />
            {children}
            <Toaster />
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
