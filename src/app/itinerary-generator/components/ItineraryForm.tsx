"use client"

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/core";
import { useToast } from "@/components/ui/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import Link from "next/link";
import { ItineraryFormProps, FormData, CityId } from "../types";
import { useEffect, useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ChevronDown, MapPin, Mountain, Waves, Building2, Map, Globe, Activity } from "lucide-react";
import { DollarSign, PiggyBank, CreditCard, Wallet, Coins, Gem } from "lucide-react";

export interface DestinationPill {
  /** Stable UI key. Two pills may share a cityId, so this is what drives the pressed state. */
  key: string;
  /** What the user reads on the tile. */
  label: string;
  /** The city that is ACTUALLY generated. Never a region name. */
  cityId: CityId;
  sublabel: string;
  Icon: any;
}

/**
 * Destination pills mirror the dashboard's Suggested Spots row
 * (Baguio / Manila / Davao / Visayas / Luzon).
 *
 * Visayas and Luzon are ALIASES, not scopes. A Gala itinerary is strictly
 * single-city: one cityId, one POI bounds box, one map viewport. A region
 * union would have to route a day across members that sit 282 km apart over
 * open water (boracay->cebu) or 206 km apart on land (baguio->manila), against
 * a 50 km city search radius. So each region pill resolves to its member with
 * the best coverage, and the sublabel names that city so the tile never
 * promises more than it delivers.
 *
 * The cityId sent to the API is always a real member id, so no route, zod
 * enum, CITY_CONFIGS row, TargetCityId entry, or persistence change is needed.
 */
export const CITY_PILLS: DestinationPill[] = [
  { key: "baguio", label: "Baguio", cityId: "baguio", sublabel: "City of Pines", Icon: Mountain },
  { key: "manila", label: "Manila", cityId: "manila", sublabel: "Capital", Icon: Building2 },
  { key: "davao", label: "Davao", cityId: "davao", sublabel: "Durian City", Icon: MapPin },
  { key: "visayas", label: "Visayas", cityId: "boracay", sublabel: "Boracay, Aklan", Icon: Waves },
  { key: "luzon", label: "Luzon", cityId: "manila", sublabel: "Metro Manila", Icon: Building2 },
]

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
  trafficAware,
  setTrafficAware,
  selectedCity,
  setSelectedCity,
}: ItineraryFormProps) {
  const { toast } = useToast();
  // Pill identity is UI-only: Manila and Luzon both anchor to Metro Manila, so
  // the pressed tile follows the pill the user pressed, not the city id.
  const [activePillKey, setActivePillKey] = useState(
    CITY_PILLS.find((p) => p.cityId === selectedCity)?.key ?? CITY_PILLS[0].key
  );
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
      selectedInterests,
      trafficAware,
      cityId: selectedCity,
    };
    
    onSubmitItinerary(formData);
  };

  return (
    <div className="w-full bg-gray-100">
    <div className="w-full rounded-tl-7xl bg-white p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600">
            Tarana Gala
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-[1.75rem]">
            Plan Your {CITY_PILLS.find((p) => p.key === activePillKey)?.label ?? "Baguio"} Adventure
          </h2>
        </div>
        <label
          className={cn(
            "flex cursor-pointer select-none items-center justify-between gap-3 self-start rounded-full border py-2 pl-4 pr-2 transition-colors sm:self-auto",
            trafficAware
              ? "border-blue-200 bg-blue-50 hover:bg-blue-100/70"
              : "border-gray-200 bg-white hover:border-gray-300"
          )}
        >
          <span className={`flex items-center gap-2 text-sm font-medium ${trafficAware ? "text-blue-700" : "text-gray-500"}`}>
            <Activity className={`h-4 w-4 ${trafficAware ? "text-blue-600" : "text-gray-400"}`} aria-hidden="true" />
            Traffic-aware
          </span>
          <button
            type="button"
            role="switch"
            onClick={() => setTrafficAware(!trafficAware)}
            className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
              trafficAware ? 'bg-blue-600' : 'bg-gray-300'
            }`}
            aria-checked={trafficAware}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                trafficAware ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
      </div>
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
              className="inline-flex items-center rounded-xl bg-gradient-to-b from-blue-700 to-blue-500 hover:to-blue-700 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-blue-500/30 transition"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      )}
      <form className="space-y-8" onSubmit={handleSubmit}>
        {/* Destination — strict city scope */}
        <div>
          <Label className="block font-medium mb-2 text-gray-900">Destination</Label>
          <p className="text-xs text-gray-500 mb-3">Choose where to generate — Baguio uses curated guides, others use live locations + accurate images. Each tile generates one city, named in the subtitle.</p>
          {/* Pills mirror the dashboard's Suggested Spots row. Visayas and
              Luzon are aliases that resolve to a real member city id, so the
              API never receives a region. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {CITY_PILLS.map((pill) => {
              const isSelected = activePillKey === pill.key
              return (
                <button
                  type="button"
                  key={pill.key}
                  onClick={() => {
                    if (showPreview || disabled) return
                    setActivePillKey(pill.key)
                    setSelectedCity(pill.cityId)
                  }}
                  disabled={showPreview || disabled}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-xl border py-3 px-2 text-center transition",
                    isSelected
                      ? "bg-gradient-to-b from-blue-700 to-blue-500 text-white border-blue-500 shadow-md"
                      : "bg-white border-gray-300 text-gray-700 hover:border-blue-300 hover:text-blue-600",
                    (showPreview || disabled) && "cursor-not-allowed opacity-60"
                  )}
                >
                  <pill.Icon className={cn("h-5 w-5", isSelected ? "text-white" : "text-gray-500")} />
                  <span className="text-xs font-semibold leading-none">{pill.label}</span>
                  <span className={cn("text-[10px] leading-none", isSelected ? "text-blue-100" : "text-gray-400")}>{pill.sublabel}</span>
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Visayas plans Boracay and Luzon plans Metro Manila — a trip is always one city.</p>
        </div>
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
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="center">
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
          <div className="grid grid-cols-4 gap-3">
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
          <div className="grid grid-cols-4 gap-3">
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
          <div className="relative">
            <div className="flex gap-3">
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
              showPreview ? 'bg-blue-700 text-white shadow-lg' : 'bg-gradient-to-b from-blue-700 to-blue-500 hover:to-blue-700 text-white',
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