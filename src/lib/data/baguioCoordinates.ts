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
    lat: 16.4093,
    lon: 120.5950,
    name: "Burnham Park",
    category: "park"
  },
  "Mines View Park": {
    lat: 16.4013,
    lon: 120.6003,
    name: "Mines View Park",
    category: "viewpoint"
  },
  "Baguio Cathedral": {
    lat: 16.4075,
    lon: 120.5923,
    name: "Baguio Cathedral",
    category: "religious"
  },
  "Botanical Garden": {
    lat: 16.4141,
    lon: 120.6132,
    name: "Botanical Garden",
    category: "nature"
  },
  "The Mansion": {
    lat: 16.4124,
    lon: 120.6215,
    name: "The Mansion",
    category: "historical"
  },
  "Wright Park": {
    lat: 16.4151,
    lon: 120.6186,
    name: "Wright Park",
    category: "park"
  },
  "Camp John Hay": {
    lat: 16.3994,
    lon: 120.6157,
    name: "Camp John Hay",
    category: "recreational"
  },
  "Bencab Museum": {
    lat: 16.3805,
    lon: 120.6259,
    name: "Bencab Museum",
    category: "museum"
  },
  "Tam-Awan Village": {
    lat: 16.4300,
    lon: 120.5769,
    name: "Tam-Awan Village",
    category: "cultural"
  },

  // Shopping & Markets
  "Baguio Night Market": {
    lat: 16.4121,
    lon: 120.5961,
    name: "Baguio Night Market",
    category: "market"
  },
  "SM City Baguio": {
    lat: 16.4092,
    lon: 120.5998,
    name: "SM City Baguio",
    category: "mall"
  },
  "Baguio Public Market": {
    lat: 16.4153,
    lon: 120.5957,
    name: "Baguio Public Market",
    category: "market"
  },
  "Good Shepherd Convent": {
    lat: 16.4063,
    lon: 120.6025,
    name: "Good Shepherd Convent",
    category: "religious"
  },

  // Nature & Adventure Sites
  "Mirador Heritage and Eco Park": {
    lat: 16.4089,
    lon: 120.5812,
    name: "Mirador Heritage and Eco Park",
    category: "nature"
  },
  "Diplomat Hotel": {
    lat: 16.4059,
    lon: 120.5851,
    name: "Diplomat Hotel",
    category: "historical"
  },
  "Lions Head": {
    lat: 16.3603,
    lon: 120.6128,
    name: "Lions Head",
    category: "viewpoint"
  },
  "Ili-Likha Artists Village": {
    lat: 16.4138,
    lon: 120.5974,
    name: "Ili-Likha Artists Village",
    category: "cultural"
  },
  "Philippine Military Academy": {
    lat: 16.3609,
    lon: 120.6197,
    name: "Philippine Military Academy",
    category: "educational"
  },
  "Great wall of Baguio": {
    lat: 16.3698,
    lon: 120.6116,
    name: "Great wall of Baguio",
    category: "viewpoint"
  },
  "Camp John Hay Yellow Trail": {
    lat: 16.3994,
    lon: 120.6157,
    name: "Camp John Hay Yellow Trail",
    category: "trail"
  },

  // La Trinidad Area (Near Baguio)
  "Valley of Colors": {
    lat: 16.4583,
    lon: 120.5908,
    name: "Valley of Colors",
    category: "cultural"
  },
  "Easter Weaving Room": {
    lat: 16.4226,
    lon: 120.5901,
    name: "Easter Weaving Room",
    category: "cultural"
  },
  "Mt. Kalugong": {
    lat: 16.4603,
    lon: 120.5956,
    name: "Mt. Kalugong",
    category: "mountain"
  },

  // Food & Dining
  "Chimichanga by Jaimes Family Feast": {
    lat: 16.4083,
    lon: 120.5931,
    name: "Chimichanga by Jaimes Family Feast",
    category: "restaurant"
  },
  "Kapi Kullaaw": {
    lat: 16.4138,
    lon: 120.5973,
    name: "Kapi Kullaaw",
    category: "cafe"
  },
  "Itaewon Cafe": {
    lat: 16.4140,
    lon: 120.5951,
    name: "Itaewon Cafe",
    category: "cafe"
  },
  "Agara Ramen": {
    lat: 16.4090,
    lon: 120.6020,
    name: "Agara Ramen",
    category: "restaurant"
  },
  "KoCo Cafe": {
    lat: 16.4083,
    lon: 120.5944,
    name: "KoCo Cafe",
    category: "cafe"
  },
  "Good Sheperd Cafe": {
    lat: 16.4063,
    lon: 120.6025,
    name: "Good Sheperd Cafe",
    category: "cafe"
  },
  "Tavern Cafe": {
    lat: 16.3799,
    lon: 120.6173,
    name: "Tavern Cafe",
    category: "cafe"
  },
  "Oh My Gulay": {
    lat: 16.4118,
    lon: 120.5981,
    name: "Oh My Gulay",
    category: "restaurant"
  },
  "Hill Station": {
    lat: 16.4096,
    lon: 120.6006,
    name: "Hill Station",
    category: "restaurant"
  },
  "Hiraya Cafe": {
    lat: 16.4096,
    lon: 120.6006,
    name: "Hiraya Cafe",
    category: "cafe"
  },
  "Uji-Matcha Cafe": {
    lat: 16.4160,
    lon: 120.5960,
    name: "Uji-Matcha Cafe",
    category: "cafe"
  },
  "K-Flavors Buffet": {
    lat: 16.4070,
    lon: 120.5923,
    name: "K-Flavors Buffet",
    category: "restaurant"
  },
  "Korean Palace Kung Jeon": {
    lat: 16.4077,
    lon: 120.6086,
    name: "Korean Palace Kung Jeon",
    category: "restaurant"
  },
  "Myeong Dong Jjigae Restaurant": {
    lat: 16.4027,
    lon: 120.5923,
    name: "Myeong Dong Jjigae Restaurant",
    category: "restaurant"
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
  // Baguio City and La Trinidad approximate bounds
  const bounds = {
    north: 16.47,  // Extended to include La Trinidad (Mt. Kalugong, Valley of Colors)
    south: 16.35,
    east: 120.65,
    west: 120.55
  };
  
  return lat >= bounds.south && lat <= bounds.north && 
         lon >= bounds.west && lon <= bounds.east;
}
