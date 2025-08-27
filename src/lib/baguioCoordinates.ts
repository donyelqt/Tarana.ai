/**
 * Baguio City Activity Coordinates Database
 * Precise latitude/longitude coordinates for all activities in the itinerary system
 */

export interface ActivityCoordinates {
  lat: number;
  lon: number;
  name: string;
  category: string;
}

// Precise coordinates database matching itineraryData.ts activities
export const BAGUIO_COORDINATES: Record<string, ActivityCoordinates> = {
  // Core Tourist Attractions
  "Burnham Park": {
    lat: 16.4138,
    lon: 120.5934,
    name: "Burnham Park",
    category: "park"
  },
  "Mines View Park": {
    lat: 16.4023,
    lon: 120.5960,
    name: "Mines View Park",
    category: "viewpoint"
  },
  "Baguio Cathedral": {
    lat: 16.4156,
    lon: 120.5923,
    name: "Baguio Cathedral",
    category: "religious"
  },
  "Botanical Garden": {
    lat: 16.4167,
    lon: 120.5889,
    name: "Botanical Garden",
    category: "nature"
  },
  "The Mansion": {
    lat: 16.4108,
    lon: 120.5969,
    name: "The Mansion",
    category: "historical"
  },
  "Wright Park": {
    lat: 16.4089,
    lon: 120.5978,
    name: "Wright Park",
    category: "park"
  },
  "Camp John Hay": {
    lat: 16.4031,
    lon: 120.5997,
    name: "Camp John Hay",
    category: "recreational"
  },
  "Bencab Museum": {
    lat: 16.3567,
    lon: 120.6123,
    name: "Bencab Museum",
    category: "museum"
  },
  "Tam-Awan Village": {
    lat: 16.4234,
    lon: 120.5678,
    name: "Tam-Awan Village",
    category: "cultural"
  },

  // Shopping & Markets
  "Baguio Night Market": {
    lat: 16.4134,
    lon: 120.5945,
    name: "Baguio Night Market",
    category: "market"
  },
  "SM City Baguio": {
    lat: 16.4167,
    lon: 120.5889,
    name: "SM City Baguio",
    category: "mall"
  },
  "Baguio Public Market": {
    lat: 16.4145,
    lon: 120.5923,
    name: "Baguio Public Market",
    category: "market"
  },
  "Good Shepherd Convent": {
    lat: 16.4089,
    lon: 120.5834,
    name: "Good Shepherd Convent",
    category: "religious"
  },

  // Nature & Adventure Sites
  "Mirador Heritage and Eco Park": {
    lat: 16.4201,
    lon: 120.5812,
    name: "Mirador Heritage and Eco Park",
    category: "nature"
  },
  "Diplomat Hotel": {
    lat: 16.4067,
    lon: 120.5945,
    name: "Diplomat Hotel",
    category: "historical"
  },
  "Lions Head": {
    lat: 16.3978,
    lon: 120.5945,
    name: "Lions Head",
    category: "viewpoint"
  },
  "Ili-Likha Artists Village": {
    lat: 16.4123,
    lon: 120.5867,
    name: "Ili-Likha Artists Village",
    category: "cultural"
  },
  "Philippine Military Academy": {
    lat: 16.3889,
    lon: 120.5823,
    name: "Philippine Military Academy",
    category: "educational"
  },
  "Great wall of Baguio": {
    lat: 16.4089,
    lon: 120.5756,
    name: "Great wall of Baguio",
    category: "viewpoint"
  },
  "Camp John Hay Yellow Trail": {
    lat: 16.4031,
    lon: 120.5997,
    name: "Camp John Hay Yellow Trail",
    category: "trail"
  },

  // La Trinidad Area (Near Baguio)
  "Valley of Colors": {
    lat: 16.4567,
    lon: 120.5923,
    name: "Valley of Colors",
    category: "cultural"
  },
  "Easter Weaving Room": {
    lat: 16.4234,
    lon: 120.5756,
    name: "Easter Weaving Room",
    category: "cultural"
  },
  "Mt. Kalugong": {
    lat: 16.4678,
    lon: 120.5834,
    name: "Mt. Kalugong",
    category: "mountain"
  }
};

/**
 * Get coordinates for an activity by name
 */
export function getActivityCoordinates(activityName: string): ActivityCoordinates | null {
  // Direct match first
  if (BAGUIO_COORDINATES[activityName]) {
    return BAGUIO_COORDINATES[activityName];
  }

  // Fuzzy matching for partial names
  const normalizedName = activityName.toLowerCase().trim();
  
  for (const [key, coords] of Object.entries(BAGUIO_COORDINATES)) {
    const normalizedKey = key.toLowerCase();
    
    // Check if the activity name contains the key or vice versa
    if (normalizedName.includes(normalizedKey) || normalizedKey.includes(normalizedName)) {
      return coords;
    }
    
    // Check for common variations
    if (normalizedName.includes('market') && normalizedKey.includes('market')) {
      return coords;
    }
    if (normalizedName.includes('park') && normalizedKey.includes('park')) {
      return coords;
    }
    if (normalizedName.includes('museum') && normalizedKey.includes('museum')) {
      return coords;
    }
  }

  return null;
}

/**
 * Get all coordinates for a specific category
 */
export function getCoordinatesByCategory(category: string): ActivityCoordinates[] {
  return Object.values(BAGUIO_COORDINATES).filter(coord => coord.category === category);
}

/**
 * Calculate distance between two coordinates (in kilometers)
 */
export function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
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
export function findNearbyActivities(
  centerLat: number, 
  centerLon: number, 
  radiusKm: number = 2
): ActivityCoordinates[] {
  return Object.values(BAGUIO_COORDINATES).filter(coord => {
    const distance = calculateDistance(centerLat, centerLon, coord.lat, coord.lon);
    return distance <= radiusKm;
  });
}

/**
 * Get the center point of Baguio City
 */
export function getBaguioCityCenter(): ActivityCoordinates {
  return {
    lat: 16.4134,
    lon: 120.5934,
    name: "Baguio City Center",
    category: "center"
  };
}

/**
 * Validate if coordinates are within Baguio City bounds
 */
export function isWithinBaguioBounds(lat: number, lon: number): boolean {
  // Baguio City approximate bounds
  const bounds = {
    north: 16.45,
    south: 16.35,
    east: 120.65,
    west: 120.55
  };
  
  return lat >= bounds.south && lat <= bounds.north && 
         lon >= bounds.west && lon <= bounds.east;
}
