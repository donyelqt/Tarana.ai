import type React from "react"
import type { Metadata } from "next"
// import { Inter } from "next/font/google" 
import "./globals.css"
import { SessionProvider } from '@/components/providers/SessionProvider'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { ToastProvider } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster";
import SmokeEffect from "@/components/ui/SmokeEffect";
import { ReferralTracker } from "@/components/ReferralTracker";

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
          <QueryProvider>
            <ToastProvider>
              <ReferralTracker />
              <SmokeEffect />
              {children}
              <Toaster />
            </ToastProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
