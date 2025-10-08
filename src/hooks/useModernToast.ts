/**
 * Modern Toast Hook
 * Sleek, minimalist toast notifications with enterprise-grade design
 * Built on shadcn/ui with clean string-based content
 */

import { useToast } from "@/components/ui/use-toast"

export const useModernToast = () => {
  const { toast } = useToast()

  return {
    // Processing state - Minimalist loading
    processing: (title: string, description?: string) => {
      toast({
        title: `🔄 ${title}`,
        description: description || "Processing...",
        duration: 8000,
      })
    },

    // Success state - Clean success
    success: (title: string, description?: string, features?: string[]) => {
      toast({
        title: `✅ ${title}`,
        description: description || "Complete",
        variant: "success" as const,
        duration: 4000,
      })
    },

    // Optimized state - Already good
    optimized: (title: string, description?: string) => {
      toast({
        title: `⚡ ${title}`,
        description: description || "Already optimal",
        variant: "default" as const,
        duration: 3000,
      })
    },

    // Error state - Simple error
    error: (title: string, description?: string) => {
      toast({
        title: `❌ ${title}`,
        description: description || "Try again",
        variant: "destructive" as const,
        duration: 4000,
      })
    },

    // Connection error - Network issue
    connectionError: (title: string, description?: string) => {
      toast({
        title: `📡 ${title}`,
        description: description || "Check connection",
        variant: "destructive" as const,
        duration: 4000,
      })
    }
  }
}
