"use client"

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { WeatherData } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";

interface ItineraryFormProps {
  showPreview: boolean;
  isGenerating: boolean;
  isLoadingItinerary: boolean;
  onSubmitItinerary: (formData: FormData) => void;
  weatherData: WeatherData | null;
  budget: string;
  setBudget: React.Dispatch<React.SetStateAction<string>>;
  pax: string;
  setPax: React.Dispatch<React.SetStateAction<string>>;
  duration: string;
  setDuration: React.Dispatch<React.SetStateAction<string>>;
  dates: { start: Date | undefined; end: Date | undefined };
  setDates: React.Dispatch<React.SetStateAction<{ start: Date | undefined; end: Date | undefined }>>;
  selectedInterests: string[];
  setSelectedInterests: React.Dispatch<React.SetStateAction<string[]>>;
  handleInterest: (interest: string) => void;
  interests: { label: string; icon: React.ReactNode }[];
  budgetOptions: string[];
  paxOptions: string[];
  durationOptions: string[];
}

export interface FormData {
  budget: string;
  pax: string;
  duration: string;
  dates: { start: Date | undefined; end: Date | undefined };
  selectedInterests: string[];
}

export default function ItineraryForm({
  showPreview,
  isGenerating,
  isLoadingItinerary: _isLoadingItinerary,
  onSubmitItinerary,
  weatherData: _weatherData,
  budget,
  setBudget,
  pax,
  setPax,
  duration,
  setDuration,
  dates,
  setDates,
  selectedInterests,
  setSelectedInterests: _setSelectedInterests,
  handleInterest,
  interests: propInterests, // Renaming to avoid conflict with imported 'interests'
  budgetOptions,
  paxOptions,
  durationOptions
}: ItineraryFormProps) {
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const durationNum = parseInt(duration);
      if (!isNaN(durationNum) && diffDays !== durationNum) {
        toast({
          title: "Invalid Travel Dates",
          description: `The selected travel dates do not match the chosen duration (${durationNum} days). Please adjust your dates.`,
          variant: "destructive",
        });
        return;
      }
    }
    onSubmitItinerary({ budget, pax, duration, dates, selectedInterests });
  };

  return (
    <div className="w-full bg-gray-100">
    <div className="w-full rounded-tl-7xl bg-white p-6">
      <div className="text-2xl font-bold mb-6 text-black">Let&apos;s Plan Your Baguio Adventure</div>
      {/* <hr className="my-6 w-full border-gray-200" /> */}
      <form className="space-y-8" onSubmit={handleSubmit}>
        {/* Budget Range */}
        <div>
          <Label htmlFor="budget" className="block font-medium mb-2 text-gray-900">Budget Range</Label>
          <select
            id="budget"
            className={cn(
              "w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2",
              showPreview ? 'border-gray-300' : 'border-gray-300 focus:ring-blue-200'
            )}
            value={budget}
            onChange={e => setBudget(e.target.value)}
            disabled={showPreview}
          >
            {budgetOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
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
                  showPreview ? 'cursor-not-allowed' : ''
                )}
                onClick={() => !showPreview && setPax(opt)}
                disabled={showPreview}
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
                  showPreview ? 'cursor-not-allowed' : ''
                )}
                onClick={() => !showPreview && setDuration(opt)}
                disabled={showPreview}
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
                  showPreview ? 'cursor-not-allowed' : ''
                )}
                onClick={() => !showPreview && handleInterest(label)}
                disabled={showPreview}
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
              (showPreview || isGenerating) ? 'cursor-not-allowed' : ''
            )}
            disabled={showPreview || isGenerating}
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