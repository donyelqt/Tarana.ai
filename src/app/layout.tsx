import type React from "react"
import type { Metadata, Viewport } from "next"
// import { Inter } from "next/font/google" 
import "./globals.css"
import { SessionProvider } from '@/components/providers/SessionProvider'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { ToastProvider } from "@/components/ui/use-toast"
import { SoundProvider } from '@/lib/sound/SoundProvider'
import { SidebarProvider } from '@/components/Sidebar';
import { Toaster } from "@/components/ui/toaster";
import SmokeEffect from "@/components/ui/SmokeEffect";
import { ReferralTracker } from "@/components/ReferralTracker";

// const inter = Inter({ subsets: ["latin"] })

// Explicit viewport: keep user scaling ENABLED so pinch-to-zoom (2 fingers)
// and the in-app "+" zoom button still work. We do NOT set maximum-scale or
// userScalable:false -- that would disable pinch, which we want to keep.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: "Tarana-ai | Plan Your Perfect Baguio Trip",
  description:
    "We craft your perfect itinerary — personalized to your budget, interests, group size, and real-time traffic conditions.",
  icons: {
    icon: "/images/taranaai.png",
  },
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
            <SoundProvider><SidebarProvider><ToastProvider>
              <ReferralTracker />
              <SmokeEffect />
              {children}
              <Toaster />
            </ToastProvider></SidebarProvider></SoundProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
