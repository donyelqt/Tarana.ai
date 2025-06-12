// Adapted from shadcn UI toast component
// https://ui.shadcn.com/docs/components/toast

"use client"

import { useToast } from "./use-toast"
import { useEffect } from "react"

// New component for individual toast item
function ToastItem({ toast, dismiss }: { toast: any; dismiss: (id: string) => void }) {
  const { id, title, description, variant, duration, action } = toast

  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        dismiss(id)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [id, duration, dismiss])

  return (
    <div
      key={id} // key is still useful here for React's reconciliation, though it won't be passed as a prop
      className={`w-full bg-white border rounded-lg shadow-lg p-4 transition-all transform translate-x-0 slide-in-from-right-full animate-in duration-300 ${variant === "destructive" ? "border-red-500 bg-red-50" : variant === "success" ? "border-green-500 bg-green-50" : "border-gray-200"}`}
      role="alert"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1">
          {title && <h3 className={`font-medium ${variant === "destructive" ? "text-red-800" : variant === "success" ? "text-green-800" : "text-gray-900"}`}>{title}</h3>}
          {description && <div className={`text-sm mt-1 ${variant === "destructive" ? "text-red-700" : variant === "success" ? "text-green-700" : "text-gray-700"}`}>{description}</div>}
        </div>
        <button
          onClick={() => dismiss(id)}
          className="text-gray-400 hover:text-gray-500 focus:outline-none"
        >
          <span className="sr-only">Close</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed top-0 z-[100] flex flex-col items-end gap-2 p-4 max-w-[420px] w-full right-0">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />
      ))}
    </div>
  )
}