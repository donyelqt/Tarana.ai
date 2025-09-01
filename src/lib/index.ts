/**
 * Tarana.ai Library - Enterprise-Grade Module Organization
 * 
 * This is the main entry point for all library modules organized by domain.
 * Follow domain-driven design principles for maintainable, scalable code.
 * 
 * @author Doniele Arys Antonio
 * @version 3.0.0
 */

// Authentication & Authorization
export * from './auth';

// Search & Discovery Engine
export * from './search';

// Traffic Analysis & Optimization
export * from './traffic';

// AI & Machine Learning
export * from './ai';

// External API Integrations
export * from './integrations';

// Core Utilities & Types
export * from './core';

// Data Management & Storage (explicit exports to avoid conflicts)
export {
  getSavedItineraries,
  deleteItinerary,
  saveItinerary,
  updateItinerary,
  formatDateRange,
  getActivityCoordinates,
  calculateDistance,
  findNearbyActivities,
  BaguioCoords
} from './data';

export type {
  SavedItinerary,
  ItineraryActivity,
  ItineraryPeriod,
  ItineraryData as SavedItineraryData
} from './data';

// Email Services
export * from './email';

// Image Processing
export * from './images';

// Security (already organized)
export * from './security';

// Services (already organized)
export * from './services';

// Legacy Utils (backward compatibility)
export * from './utils';
