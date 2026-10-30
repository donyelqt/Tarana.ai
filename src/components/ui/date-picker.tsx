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
  className?: string;
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
          {}
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