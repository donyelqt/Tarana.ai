import * as React from "react"
import { cn } from "../../lib/utils"

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, checked, onCheckedChange, ...props }, ref) => {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500",
        className
      )}
      ref={ref}
      checked={checked}
      onChange={e => onCheckedChange && onCheckedChange(e.target.checked)}
      {...props}
    />
  )
})
Checkbox.displayName = "Checkbox"

export { Checkbox }