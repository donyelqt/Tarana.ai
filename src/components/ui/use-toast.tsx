// Adapted from shadcn UI toast component
// https://ui.shadcn.com/docs/components/toast

"use client"

import { useState, createContext, useContext, ReactNode } from "react"

type ToastProps = {
  id: string
  title?: string
  description?: string
  action?: ReactNode
  variant?: "default" | "destructive" | "success"
  duration?: number
}

type ToastContextType = {
  toasts: ToastProps[]
  toast: (props: Omit<ToastProps, "id">) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export const TOAST_REMOVE_DELAY = 3000

export function ToastProvider({ children }: { children: ReactNode }) {

  const [toasts, setToasts] = useState<ToastProps[]>([])

  const toast = ({ title, description, variant, duration = TOAST_REMOVE_DELAY, action }: Omit<ToastProps, "id">) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prevToasts) => [...prevToasts, { id, title, description, variant, duration, action }])

    return id
  }

  const dismiss = (id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }

  return context
}