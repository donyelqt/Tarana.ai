import { StaticImageData } from "next/image";
import { WeatherData } from "@/lib/utils";

export interface FormData {
  budget: string;
  pax: string;
  duration: string;
  dates: { start: Date | undefined; end: Date | undefined };
  selectedInterests: string[];
}

export interface Activity {
  image: StaticImageData | string;
  title: string;
  time: string;
  desc: string;
  tags: string[];
  relevanceScore?: number; // Optional relevance score from RAG results
}

export interface ItinerarySection {
  period: string;
  activities: Activity[];
  reason?: string; // AI-generated reason for empty time slots
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
}

export interface ItineraryPreviewProps {
  showPreview: boolean;
  isLoadingItinerary: boolean;
  generatedItinerary: ItineraryData | null;
  weatherData: WeatherData | null;
  onSave: () => void;
  taranaaiLogo: StaticImageData | string;
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
  };
  itineraryData: ItineraryData;
  weatherData?: WeatherData;
  createdAt: string;
}