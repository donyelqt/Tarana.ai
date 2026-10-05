"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/core"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  /**
   * Width override for the trigger.
   *
   * The 220px default suits a `flex gap-3` row but overflows a two-column
   * grid, where two fixed triggers plus the gap exceed the container and the
   * row spills. Callers laying the trigger out in a grid pass `w-full min-w-0`
   * so each one fills its own column instead of imposing a fixed width.
   */
  className?: string;
  /**
   * date-fns pattern for the selected date.
   *
   * `PPP` ("September 30th, 2026") needs about 198px of button, measured in
   * the island's 14px General Sans. A caller with a narrower trigger passes a
   * compact pattern such as "MMM d, yyyy" ("Sep 30, 2026", ~80px) instead of
   * letting the label truncate.
   */
  dateFormat?: string;
}

export function DatePicker({
  date,
  setDate,
  disabled,
  placeholder,
  className,
  dateFormat = "PPP",
}: DatePickerProps) {

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[220px] justify-start text-left font-normal",
            className,
            !date && "text-muted-foreground",
            date && "border-[#0066FF] text-[#0066FF] hover:text-[#0066FF]"
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {/* Truncating, because a caller may now make the trigger narrower than
              the formatted date, and an overflowing label would spill outside
              the button. */}
          <span className="truncate">
            {date ? format(date, dateFormat) : placeholder || "Pick a date"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
} 