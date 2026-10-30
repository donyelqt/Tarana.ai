
import { useToast } from "@/components/ui/use-toast"

export const useModernToast = () => {
  const { toast } = useToast()

  return {
    processing: (title: string, description?: string) => {
      toast({
        title: `🔄 ${title}`,
        description: description || "Processing...",
        duration: 8000,
      })
    },

    success: (title: string, description?: string, features?: string[]) => {
      toast({
        title: `✅ ${title}`,
        description: description || "Complete",
        variant: "success" as const,
        duration: 4000,
      })
    },

    optimized: (title: string, description?: string) => {
      toast({
        title: `⚡ ${title}`,
        description: description || "Already optimal",
        variant: "default" as const,
        duration: 3000,
      })
    },

    error: (title: string, description?: string) => {
      toast({
        title: `❌ ${title}`,
        description: description || "Try again",
        variant: "destructive" as const,
        duration: 4000,
      })
    },

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
