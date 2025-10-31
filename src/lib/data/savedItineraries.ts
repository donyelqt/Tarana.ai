// Utility functions for managing saved itineraries
import { StaticImageData } from "next/image";

export interface ItineraryActivity {
  image: string | StaticImageData;
  title: string;
  time: string;
  desc: string;
  tags: string[];
  // ✅ CRITICAL: Traffic metadata fields for smart refresh
  trafficAnalysis?: {
    realTimeTraffic?: {
      trafficLevel?: string;
      congestionScore?: number;
      recommendationScore?: number;
    };
    lat?: number;
    lon?: number;
  };
  trafficData?: any;
  trafficLevel?: string;
  trafficRecommendation?: string;
  lat?: number;
  lon?: number;
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

import { WeatherData } from "../core/utils"; // Added import
import { normalizeImagePath, getFallbackImage } from "../images/imageUtils";
import { RefreshMetadata, TrafficSnapshot } from "../services/itineraryRefreshService";

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
  // Enhanced refresh metadata
  refreshMetadata?: RefreshMetadata;
  trafficSnapshot?: TrafficSnapshot;
  activityCoordinates?: Array<{ lat: number; lon: number; name: string }>;
}

import { supabase } from "./supabaseClient"; // Import Supabase client
async function getCurrentUserId(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') {
      const [{ getServerSession }, { authOptions }] = await Promise.all([
        import('next-auth'),
        import('../auth/auth'),
      ]);

      const session = await getServerSession(authOptions);
      return session?.user?.id ?? null;
    }

    const { getSession } = await import('next-auth/react');
    const session = await getSession();
    return session?.user?.id ?? null;
  } catch (error) {
    console.error('Failed to resolve current user session:', error);
    return null;
  }
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
      image: normalizeImagePath(item.image) || getFallbackImage(item.tags),
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
    image: normalizeImagePath(typeof itinerary.image === 'string' ? itinerary.image : (itinerary.image as StaticImageData).src) || getFallbackImage(itinerary.tags),
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

  // 🔍 CRITICAL DEBUG: Log incoming data
  console.log('\n🔍 updateItinerary() - INCOMING DATA:');
  console.log('   ID:', id);
  console.log('   trafficSnapshot:', updatedData.trafficSnapshot ? 'EXISTS' : 'NULL/UNDEFINED');
  console.log('   refreshMetadata:', updatedData.refreshMetadata ? 'EXISTS' : 'NULL/UNDEFINED');
  console.log('   activityCoordinates:', updatedData.activityCoordinates ? `EXISTS (${updatedData.activityCoordinates.length})` : 'NULL/UNDEFINED');
  
  if (updatedData.refreshMetadata) {
    console.log('   refreshMetadata.trafficSnapshot:', updatedData.refreshMetadata.trafficSnapshot ? 'EXISTS' : 'NULL/UNDEFINED');
    console.log('   refreshMetadata.refreshCount:', updatedData.refreshMetadata.refreshCount);
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
  
  // ✅ CRITICAL FIX: Use explicit undefined check instead of truthy check
  // This allows null, empty objects, and empty arrays to be set
  if (updatedData.refreshMetadata !== undefined) {
    updatePayload.refresh_metadata = updatedData.refreshMetadata;
  }
  if (updatedData.trafficSnapshot !== undefined) {
    updatePayload.traffic_snapshot = updatedData.trafficSnapshot;
  }
  if (updatedData.activityCoordinates !== undefined) {
    updatePayload.activity_coordinates = updatedData.activityCoordinates;
  }
  // Do not allow updating user_id or created_at directly
  
  // 🔍 CRITICAL DEBUG: Log what will be sent to database
  console.log('\n📤 updateItinerary() - PAYLOAD TO DATABASE:');
  console.log('   Keys being updated:', Object.keys(updatePayload));
  console.log('   refresh_metadata:', updatePayload.refresh_metadata ? 'SET' : 'NOT SET');
  console.log('   traffic_snapshot:', updatePayload.traffic_snapshot ? 'SET' : 'NOT SET');
  console.log('   activity_coordinates:', updatePayload.activity_coordinates ? 'SET' : 'NOT SET');

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
      console.error('\n❌ updateItinerary() - SUPABASE ERROR:', error);
      console.error('   Error code:', error.code);
      console.error('   Error message:', error.message);
      console.error('   Error details:', error.details);
      return null;
    }
    
    // 🔍 CRITICAL DEBUG: Log what database returned
    console.log('\n✅ updateItinerary() - DATABASE RESPONSE:');
    console.log('   Update successful');
    console.log('   refresh_metadata in response:', data.refresh_metadata ? 'EXISTS' : 'NULL');
    console.log('   traffic_snapshot in response:', data.traffic_snapshot ? 'EXISTS' : 'NULL');
    console.log('   activity_coordinates in response:', data.activity_coordinates ? 'EXISTS' : 'NULL');
    
    if (data.refresh_metadata) {
      console.log('   refresh_metadata.refreshCount:', (data.refresh_metadata as any).refreshCount);
      console.log('   refresh_metadata.trafficSnapshot:', (data.refresh_metadata as any).trafficSnapshot ? 'EXISTS' : 'NULL');
    }
    
    return data as SavedItinerary;
  } catch (error) {
    console.error('\n❌ updateItinerary() - EXCEPTION:', error);
    console.error('   Error type:', error instanceof Error ? error.constructor.name : typeof error);
    throw new Error('Failed to update itinerary');
  }
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