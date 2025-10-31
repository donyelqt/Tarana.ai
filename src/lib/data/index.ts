// Data Management & Storage Module
export * from './savedItineraries';
export * from './supabaseClient';
export * from './supabaseMeals';

// Baguio Coordinates (explicit exports to avoid conflicts)
export {
  getActivityCoordinates,
  calculateDistance,
  findNearbyActivities,
  BAGUIO_COORDINATES as BaguioCoords
} from './baguioCoordinates';
