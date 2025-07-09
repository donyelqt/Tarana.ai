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

import { WeatherData } from "../lib/utils"; // Added import

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
  weatherData?: WeatherData; // Added optional weatherData property
  createdAt: string;
}

import { supabase } from "./supabaseClient"; // Import Supabase client
import { getSession } from 'next-auth/react'; // To get current user session

// Function to get the current user's ID from the session
async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  if (session && session.user && session.user.id) {
    return session.user.id;
  }
  return null;
}

export const getSavedItineraries = async (): Promise<SavedItinerary[]> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.log('No user logged in, returning empty itineraries.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('itineraries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading saved itineraries from Supabase:', error);
      return [];
    }
    // Ensure data matches SavedItinerary structure, especially for JSON fields
    return data.map(item => ({
      ...item,
      formData: typeof item.form_data === 'string' ? JSON.parse(item.form_data) : item.form_data,
      itineraryData: typeof item.itinerary_data === 'string' ? JSON.parse(item.itinerary_data) : item.itinerary_data,
    })) as SavedItinerary[];
  } catch (error) {
    console.error('Error loading saved itineraries:', error);
    return [];
  }
};

export const saveItinerary = async (itinerary: Omit<SavedItinerary, 'id' | 'createdAt'>): Promise<SavedItinerary> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('SaveItinerary: User ID is null. User must be logged in.');
    throw new Error('User must be logged in to save an itinerary');
  }

  const newItineraryData = {
    user_id: userId,
    title: itinerary.title,
    date: itinerary.date,
    budget: itinerary.budget,
    image: typeof itinerary.image === 'string' ? itinerary.image : (itinerary.image as StaticImageData).src,
    tags: itinerary.tags,
    form_data: itinerary.formData,
    itinerary_data: itinerary.itineraryData,
    weather_data: itinerary.weatherData, // Stored as JSONB, optional. Ensure this is included if present in 'itinerary'
  };

  try {
    console.log('Attempting to save itinerary with data:', JSON.stringify(newItineraryData, null, 2)); // Log data being sent

    const { data, error } = await supabase
      .from('itineraries')
      .insert(newItineraryData)
      .select()
      .single();

    if (error) {
      // More detailed error logging
      console.error('Error saving itinerary to Supabase. Code:', error.code);
      console.error('Error saving itinerary to Supabase. Message:', error.message);
      console.error('Error saving itinerary to Supabase. Details:', error.details);
      console.error('Error saving itinerary to Supabase. Hint:', error.hint);
      console.error('Full error object:', JSON.stringify(error, null, 2)); // Log the full error object
      throw new Error(`Failed to save itinerary. Code: ${error.code || 'N/A'}`);
    }
    console.log('Itinerary saved successfully:', data);
    return data as SavedItinerary;
  } catch (error: any) { // Catch as 'any' to access potential properties like 'code'
    console.error('Outer catch block - Error saving itinerary:', error.message || JSON.stringify(error));
    if (error.code) {
        console.error('Outer catch block - Error code:', error.code);
    }
    throw new Error(`Failed to save itinerary. Details: ${error.message || 'Unknown error'}`);
  }
};

export const deleteItinerary = async (id: string): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('User must be logged in to delete an itinerary');
  }

  try {
    const { error } = await supabase
      .from('itineraries')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // Ensure user can only delete their own itineraries

    if (error) {
      console.error('Error deleting itinerary from Supabase:', error);
      throw new Error('Failed to delete itinerary');
    }
  } catch (error) {
    console.error('Error deleting itinerary:', error);
    throw new Error('Failed to delete itinerary');
  }
};

export const updateItinerary = async (id: string, updatedData: Partial<Omit<SavedItinerary, 'id' | 'createdAt' | 'userId'>>): Promise<SavedItinerary | null> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('User must be logged in to update an itinerary');
  }

  // Prepare data for Supabase, ensuring correct field names and types
  const updatePayload: { [key: string]: any } = {};
  if (updatedData.title) updatePayload.title = updatedData.title;
  if (updatedData.date) updatePayload.date = updatedData.date;
  if (updatedData.budget) updatePayload.budget = updatedData.budget;
  if (updatedData.image) updatePayload.image = updatedData.image as string;
  if (updatedData.tags) updatePayload.tags = updatedData.tags;
  if (updatedData.formData) updatePayload.form_data = updatedData.formData;
  if (updatedData.itineraryData) updatePayload.itinerary_data = updatedData.itineraryData;
  if (updatedData.weatherData) updatePayload.weather_data = updatedData.weatherData;
  // Do not allow updating user_id or created_at directly

  if (Object.keys(updatePayload).length === 0) {
    console.log("No data provided for update.");
    // Optionally, fetch and return the existing itinerary
    const { data: currentItinerary, error: fetchError } = await supabase
      .from('itineraries')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (fetchError || !currentItinerary) return null;
    return currentItinerary as SavedItinerary;
  }

  try {
    const { data, error } = await supabase
      .from('itineraries')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', userId) // Ensure user can only update their own itineraries
      .select()
      .single();

    if (error) {
      console.error('Error updating itinerary in Supabase:', error);
      return null;
    }
    return data as SavedItinerary;
  } catch (error) {
    console.error('Error updating itinerary:', error);
    throw new Error('Failed to update itinerary');
  }
};

const _generateItineraryId = (): string => {
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