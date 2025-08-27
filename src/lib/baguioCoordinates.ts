/**
 * Baguio City Activity Coordinates
 * Precise lat/lon coordinates for all activities for traffic analysis
 */

export interface ActivityCoordinates {
  title: string;
  lat: number;
  lon: number;
  address?: string;
}

export const BAGUIO_COORDINATES: Record<string, ActivityCoordinates> = {
  "Burnham Park": {
    title: "Burnham Park",
    lat: 16.4023,
    lon: 120.5960,
    address: "Jose Abad Santos Dr, Baguio, Benguet"
  },
  "Mines View Park": {
    title: "Mines View Park", 
    lat: 16.4033,
    lon: 120.5667,
    address: "Mines View Park Rd, Baguio, Benguet"
  },
  "Baguio Cathedral": {
    title: "Baguio Cathedral",
    lat: 16.4108,
    lon: 120.5926,
    address: "Cathedral Loop, Baguio, Benguet"
  },
  "Botanical Garden": {
    title: "Botanical Garden",
    lat: 16.4167,
    lon: 120.5833,
    address: "Leonard Wood Rd, Baguio, Benguet"
  },
  "The Mansion": {
    title: "The Mansion",
    lat: 16.4144,
    lon: 120.5894,
    address: "Mansion House Rd, Baguio, Benguet"
  },
  "Wright Park": {
    title: "Wright Park",
    lat: 16.4089,
    lon: 120.5889,
    address: "Wright Park, Baguio, Benguet"
  },
  "Camp John Hay": {
    title: "Camp John Hay",
    lat: 16.4028,
    lon: 120.5722,
    address: "Loakan Rd, Baguio, Benguet"
  },
  "Bencab Museum": {
    title: "Bencab Museum",
    lat: 16.3667,
    lon: 120.5333,
    address: "Km 6 Asin Rd, Tuba, Benguet"
  },
  "Tam-Awan Village": {
    title: "Tam-Awan Village",
    lat: 16.4333,
    lon: 120.5667,
    address: "366 Long Long, Beckel, Baguio, Benguet"
  },
  "Baguio Night Market": {
    title: "Baguio Night Market",
    lat: 16.4089,
    lon: 120.5944,
    address: "Harrison Rd, Baguio, Benguet"
  },
  "SM City Baguio": {
    title: "SM City Baguio",
    lat: 16.4167,
    lon: 120.5944,
    address: "Upper Session Rd, Baguio, Benguet"
  },
  "Baguio Public Market": {
    title: "Baguio Public Market",
    lat: 16.4111,
    lon: 120.5944,
    address: "Magsaysay Ave, Baguio, Benguet"
  },
  "Good Shepherd Convent": {
    title: "Good Shepherd Convent",
    lat: 16.4056,
    lon: 120.5889,
    address: "Gibraltar Rd, Baguio, Benguet"
  },
  "Mirador Heritage and Eco Park": {
    title: "Mirador Heritage and Eco Park",
    lat: 16.3833,
    lon: 120.5667,
    address: "La Trinidad, Benguet"
  },
  "Diplomat Hotel": {
    title: "Diplomat Hotel",
    lat: 16.4167,
    lon: 120.5778,
    address: "Dominican Hill Rd, Baguio, Benguet"
  },
  "Lions Head": {
    title: "Lions Head",
    lat: 16.3500,
    lon: 120.5833,
    address: "Kennon Rd, Baguio, Benguet"
  },
  "Ili-Likha Artists Village": {
    title: "Ili-Likha Artists Village",
    lat: 16.4056,
    lon: 120.5722,
    address: "Camp 7, Baguio, Benguet"
  },
  "Philippine Military Academy": {
    title: "Philippine Military Academy",
    lat: 16.3889,
    lon: 120.5778,
    address: "Loakan Rd, Baguio, Benguet"
  },
  "Great wall of Baguio": {
    title: "Great wall of Baguio",
    lat: 16.4167,
    lon: 120.5889,
    address: "Rimando Rd, Baguio, Benguet"
  },
  "Camp John Hay Yellow Trail": {
    title: "Camp John Hay Yellow Trail",
    lat: 16.4000,
    lon: 120.5700,
    address: "Camp John Hay, Baguio, Benguet"
  },
  "Valley of Colors": {
    title: "Valley of Colors",
    lat: 16.4500,
    lon: 120.5833,
    address: "La Trinidad, Benguet"
  },
  "Easter Weaving Room": {
    title: "Easter Weaving Room",
    lat: 16.4111,
    lon: 120.5889,
    address: "Easter School Rd, Baguio, Benguet"
  },
  "Mt. Kalugong": {
    title: "Mt. Kalugong",
    lat: 16.4667,
    lon: 120.5833,
    address: "La Trinidad, Benguet"
  }
};

/**
 * Get coordinates for an activity by title
 */
export function getActivityCoordinates(title: string): ActivityCoordinates | null {
  return BAGUIO_COORDINATES[title] || null;
}

/**
 * Get all activities with coordinates
 */
export function getAllActivityCoordinates(): ActivityCoordinates[] {
  return Object.values(BAGUIO_COORDINATES);
}

/**
 * Check if activity has coordinates
 */
export function hasCoordinates(title: string): boolean {
  return title in BAGUIO_COORDINATES;
}

/**
 * Calculate distance between two coordinates (in kilometers)
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Find nearby activities within a radius
 */
export function findNearbyActivities(centerLat: number, centerLon: number, radiusKm: number = 5): ActivityCoordinates[] {
  return getAllActivityCoordinates().filter(activity => {
    const distance = calculateDistance(centerLat, centerLon, activity.lat, activity.lon);
    return distance <= radiusKm;
  });
}
