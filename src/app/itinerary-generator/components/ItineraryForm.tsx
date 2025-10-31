"use client"

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/core";
import { useToast } from "@/components/ui/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import Link from "next/link";
import { ItineraryFormProps, FormData } from "../types";
import { useEffect, useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";
import { DollarSign, PiggyBank, CreditCard, Wallet, Coins, Gem } from "lucide-react";

export default function ItineraryForm({
  showPreview,
  isGenerating,
  isLoadingItinerary,
  onSubmitItinerary,
  budget,
  setBudget,
  pax,
  setPax,
  duration,
  setDuration,
  dates,
  setDates,
  selectedInterests,
  handleInterest,
  interests: propInterests,
  budgetOptions,
  paxOptions,
  durationOptions,
  disabled = false,
  remainingCredits,
  nextRefreshTime,
  showOutOfCredits = false,
}: ItineraryFormProps) {
  const { toast } = useToast();
  // Local state to control the budget popover
  const [openBudget, setOpenBudget] = useState(false);

  // Calculate end date whenever start date or duration changes
  useEffect(() => {
    if (dates.start && duration) {
      const startDate = new Date(dates.start);
      // Extract the number from duration string like "2 Days"
      const durationMatch = duration.match(/\d+/);
      const durationNum = durationMatch ? parseInt(durationMatch[0], 10) : 0;
      
      if (durationNum > 0) {
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + durationNum - 1); // -1 because the first day is included
        setDates({
          start: dates.start,
          end: endDate
        });
      }
    }
  }, [dates.start, duration]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (disabled) {
      toast({
        title: "Credits required",
        description: `You’ve used all Tarana Gala credits for today. Credits refresh at ${nextRefreshTime ?? 'midnight'}.`,
        variant: "destructive",
      });
      return;
    }

    if (!budget || !pax || !duration || selectedInterests.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    // Validate travel dates match duration
    if (dates.start && dates.end && duration) {
      const startDate = new Date(dates.start);
      const endDate = new Date(dates.end);
      const diffTime = endDate.getTime() - startDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      // Extract the number from duration string like "2 Days"
      const durationMatch = duration.match(/\d+/);
      const durationNum = durationMatch ? parseInt(durationMatch[0], 10) : NaN;
      
      if (!isNaN(durationNum) && diffDays !== durationNum) {
        toast({
          title: "Invalid Travel Dates",
          description: `The selected travel dates do not match the chosen duration (${durationNum} days). Please adjust your dates.`,
          variant: "destructive",
        });
        return;
      }
    }
    
    const formData: FormData = {
      budget,
      pax,
      duration,
      dates,
      selectedInterests
    };
    
    onSubmitItinerary(formData);
  };

  return (
    <div className="w-full bg-gray-100">
    <div className="w-full rounded-tl-7xl bg-white p-6">
      <div className="text-2xl font-bold mb-6 text-black">Let&apos;s Plan Your Baguio Adventure</div>
      {showOutOfCredits && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-semibold">You&apos;re out of Tarana Gala credits for today.</p>
          <p className="mt-1">
            Credits reset every midnight. Remaining today: {remainingCredits ?? 0}. Visit your dashboard to review credits and share your referral link for bonus credits.
          </p>
          {nextRefreshTime && (
            <p className="mt-1 text-xs text-blue-600">Next refresh: {nextRefreshTime}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-blue-500/30 transition hover:from-blue-600 hover:to-indigo-700"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      )}
      <form className="space-y-8" onSubmit={handleSubmit}>
        {/* Budget Range */}
        <div>
          <Label htmlFor="budget" className="block font-medium mb-2 text-gray-900">Budget Range</Label>
          <Popover open={openBudget} onOpenChange={setOpenBudget}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className={cn(
                  "w-full justify-between text-md font-medium",
                  !budget && "text-muted-foreground",
                  budget && "border-slate-300 text-gray-700 hover:text-blue-600",
                  (showPreview || disabled) && "cursor-not-allowed"
                )}
                disabled={showPreview || disabled}
              >
                {budget || "Select budget range"}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[700px] p-2" align="center">
              <div className="grid gap-1 p-2">
                {budgetOptions.map((option, idx) => {
                  let Icon;
                  // Map icon by position for visual cues
                  switch (idx) {
                    case 0:
                      Icon = PiggyBank; // lowest
                      break;
                    case 1:
                      Icon = Wallet;
                      break;
                    case 2:
                      Icon = CreditCard;
                      break;
                    case 3:
                      Icon = Gem; // highest
                      break;
                    default:
                      Icon = DollarSign;
                  }
                  return (
                    <Button
                      key={option}
                      variant="ghost"
                      className={`w-full flex items-center text-md justify-start gap-2 py-2 px-3 rounded-md text-left ${budget === option ? "bg-primary/10" : ""}`}
                      onClick={() => {
                        setBudget(option);
                        setOpenBudget(false);
                      }}
                    >
                      <Icon className="w-5 h-5 text-primary" />
                      <span>{option}</span>
                    </Button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        {/* Number of Pax */}
        <div>
          <Label className="block font-medium mb-2 text-gray-900">Number of Pax.</Label>
          <div className="grid grid-cols-4 gap-3 lg:mr-48">
            {paxOptions.map(opt => (
              <Button
                type="button"
                key={opt}
                variant="outline"
                className={cn(
                  "py-3 font-medium transition",
                  pax === opt ? 'bg-gradient-to-b from-blue-700 to-blue-500 hover:from-blue-700 text-white border-blue-500' : 'bg-white border-gray-300 text-gray-700',
                  showPreview || disabled ? 'cursor-not-allowed' : ''
                )}
                onClick={() => !(showPreview || disabled) && setPax(opt)}
                disabled={showPreview || disabled}
              >{opt}</Button>
            ))}
          </div>
        </div>
        {/* Duration */}
        <div>
          <Label className="block font-medium mb-2 text-gray-900">Duration</Label>
          <div className="grid grid-cols-4 gap-3 lg:mr-48">
            {durationOptions.map(opt => (
              <Button
                type="button"
                key={opt}
                variant="outline"
                className={cn(
                  "py-3 font-medium transition",
                  duration === opt ? 'bg-gradient-to-b from-blue-700 to-blue-500 hover:from-blue-700 text-white border-blue-500' : 'bg-white border-gray-300 text-gray-700',
                  showPreview || disabled ? 'cursor-not-allowed' : ''
                )}
                onClick={() => !(showPreview || disabled) && setDuration(opt)}
                disabled={showPreview || disabled}
              >{opt}</Button>
            ))}
          </div>
        </div>
        {/* Travel Dates */}
        <div>
          <Label className="block font-medium mb-2 text-gray-900">Travel Dates</Label>
          <div className="flex gap-3 lg:mr-48">
            <DatePicker
              date={dates.start}
              setDate={(date) => setDates({ ...dates, start: date })}
              disabled={showPreview}
              placeholder="Start date"
            />
            <DatePicker
              date={dates.end}
              setDate={(date) => setDates({ ...dates, end: date })}
              disabled={showPreview}
              placeholder="End date"
            />
          </div>
        </div>
        {/* Travel Interests */}
        <div>
          <Label className="block font-medium mb-2 text-gray-700">Travel Interests</Label>
          <div className="grid grid-cols-2 gap-3">
            {propInterests.map(({ label, icon }) => (
              <Button
                type="button"
                key={label}
                variant="outline"
                className={cn(
                  "flex items-center justify-center gap-2 py-3 font-medium transition",
                  selectedInterests.includes(label) ? 'bg-gradient-to-b from-blue-700 to-blue-500 hover:from-blue-700 text-white border-blue-500' : 'bg-white border-gray-300 text-gray-700',
                  showPreview || disabled ? 'cursor-not-allowed' : ''
                )}
                onClick={() => !(showPreview || disabled) && handleInterest(label)}
                disabled={showPreview || disabled}
              >
                <span>{icon}</span>
                {label}
              </Button>
            ))}
          </div>
        </div>
        {/* Generate Button */}
        <div>
          <Button
            type="submit"
            className={cn(
              "w-full font-semibold rounded-xl py-3 text-lg flex items-center justify-center gap-2 transition",
              showPreview ? 'bg-blue-700 text-white shadow-lg' : 'bg-gradient-to-b from-blue-700 to-blue-500 hover:from-blue-700 hover:to-purple-500 text-white',
              (showPreview || isGenerating || disabled) ? 'cursor-not-allowed' : ''
            )}
            disabled={showPreview || isGenerating || disabled}
          >
            {isGenerating ? (
              <>
                <span className="animate-pulse">Generating Itinerary...</span>
                <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              </>
            ) : (
              <>
                Generate My Itinerary
                <span className="ml-2">→</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
    </div>
  );
}