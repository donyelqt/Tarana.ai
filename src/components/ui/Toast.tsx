import React, { useEffect } from "react"

interface ToastProps {
  message: string
  show: boolean
  onClose: () => void
  type?: "success" | "error"
}

const Toast: React.FC<ToastProps> = ({ message, show, onClose, type = "success" }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [show, onClose])

  if (!show) return null

  return (
    <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-lg shadow-lg transition-all duration-300 text-white ${type === "success" ? "bg-green-500" : "bg-red-500"}`}
      role="alert"
    >
      {message}
    </div>
  )
}

export default Toast 