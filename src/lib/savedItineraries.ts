// Utility functions for managing saved itineraries
import { StaticImageData } from "next/image";

export interface ItineraryActivity {
  image: string | StaticImageData;
  title: string;
  time: string;
  desc: string;
  tags: string[];
}

export interface ItineraryPeriod {
  period: string;
  activities: ItineraryActivity[];
}

export interface ItineraryData {
  title: string;
  subtitle: string;
  items: ItineraryPeriod[];
}

export interface SavedItinerary {
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
  createdAt: string;
}

const STORAGE_KEY = 'tarana_saved_itineraries';

export const getSavedItineraries = (): SavedItinerary[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading saved itineraries:', error);
    return [];
  }
};

export const saveItinerary = (itinerary: Omit<SavedItinerary, 'id' | 'createdAt'>): SavedItinerary => {
  const newItinerary: SavedItinerary = {
    ...itinerary,
    id: generateItineraryId(),
    createdAt: new Date().toISOString()
  };
  
  const existingItineraries = getSavedItineraries();
  const updatedItineraries = [newItinerary, ...existingItineraries];
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItineraries));
    return newItinerary;
  } catch (error) {
    console.error('Error saving itinerary:', error);
    throw new Error('Failed to save itinerary');
  }
};

export const deleteItinerary = (id: string): void => {
  const existingItineraries = getSavedItineraries();
  const updatedItineraries = existingItineraries.filter(itinerary => itinerary.id !== id);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItineraries));
  } catch (error) {
    console.error('Error deleting itinerary:', error);
    throw new Error('Failed to delete itinerary');
  }
};

const generateItineraryId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const formatDateRange = (startDate: string, endDate: string): string => {
  if (!startDate || !endDate) return 'Date not specified';
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const options: Intl.DateTimeFormatOptions = { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  };
  
  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString('en-US', options);
  }
  
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
};