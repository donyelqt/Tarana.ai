import type { StaticImageData } from "next/image";

export interface Activity {
  title: string;
  duration: number;
  description: string;
  setting: "Indoor-Friendly" | "Outdoor-Friendly" | "Weather-Flexible";
  tags?: string[];
  image?: string | StaticImageData;
  time?: string;
  desc?: string;
}

export interface ItinerarySection {
  time: "Morning" | "Afternoon" | "Evening";
  activities: Activity[];
}

export interface SampleItinerary {
  morning: ItinerarySection;
  afternoon: ItinerarySection;
  evening: ItinerarySection;
}