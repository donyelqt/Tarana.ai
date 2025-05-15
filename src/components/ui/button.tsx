import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "link";
  _dummy?: never;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, type = "button", variant = "default", ...props }, ref) => {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none px-4 py-2",
        variant === "default" && "bg-[#0066FF] text-white hover:bg-[#0052cc]",
        variant === "outline" && "border border-gray-300 bg-transparent hover:bg-gray-100 text-gray-700",
        variant === "ghost" && "bg-transparent hover:bg-gray-100 text-gray-700",
        variant === "link" && "bg-transparent underline-offset-4 hover:underline text-gray-700",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }