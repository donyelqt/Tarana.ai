import { StaticImageData } from "next/image";
import { WeatherData } from "@/lib/core";

export type CityId = "baguio" | "cebu" | "manila" | "davao" | "boracay" | "el_nido" | "ph-wide" | "world"

export interface FormData {
  budget: string;
  pax: string;
  duration: string;
  dates: { start: Date | undefined; end: Date | undefined };
  selectedInterests: string[];
  peakHours?: boolean;
  trafficAware?: boolean; 
  cityId?: CityId; 
}

export interface Activity {
  image: StaticImageData | string;
  title: string;
  time: string;
  desc: string;
  tags: string[];
  peakHours?: string; 
  relevanceScore?: number; 
  isCurrentlyPeak?: boolean; 
}

export interface ItinerarySection {
  period: string;
  activities: Activity[];
  reason?: string; 
}

export interface ItineraryData {
  title: string;
  subtitle: string;
  items: ItinerarySection[];
}

export interface ItineraryFormProps {
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
  disabled?: boolean;
  remainingCredits?: number;
  nextRefreshTime?: string;
  showOutOfCredits?: boolean;
  trafficAware: boolean; 
  setTrafficAware: React.Dispatch<React.SetStateAction<boolean>>; 
  selectedCity: CityId;
  setSelectedCity: React.Dispatch<React.SetStateAction<CityId>>;
}

export interface ItineraryPreviewProps {
  showPreview: boolean;
  isLoadingItinerary: boolean;
  generatedItinerary: ItineraryData | null;
  weatherData: WeatherData | null;
  onSave: () => void;
  taranaaiLogo: StaticImageData | string;
  cityName?: string; 
}

export interface SavedItineraryItem {
  id: string;
  title: string;
  date: string;
  budget: string;
  image: string | StaticImageData;
  tags: string[];
  formData: {
    budget: string;
    pax: string;
    duration: string;
    dates: { start: string; end: string };
    selectedInterests: string[];
    peakHours?: boolean;
  };
  itineraryData: ItineraryData;
  weatherData?: WeatherData;
  createdAt: string;
}