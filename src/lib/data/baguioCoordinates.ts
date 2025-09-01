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
    lat: 16.40801,
    lon: 120.595985,
    name: "Burnham Park",
    category: "park"
  },
  "Mines View Park": {
    lat: 16.419701,
    lon: 120.627499,
    name: "Mines View Park",
    category: "viewpoint"
  },
  "Baguio Cathedral": {
    lat: 16.412901,
    lon: 120.598497,
    name: "Baguio Cathedral",
    category: "religious"
  },
  "Botanical Garden": {
    lat: 16.414116,
    lon: 120.613781,
    name: "Botanical Garden",
    category: "nature"
  },
  "The Mansion": {
    lat: 16.412356,
    lon: 120.621452,
    name: "The Mansion",
    category: "historical"
  },
  "Wright Park": {
    lat: 16.415139,
    lon: 120.61859,
    name: "Wright Park",
    category: "park"
  },
  "Camp John Hay": {
    lat: 16.399407,
    lon: 120.615699,
    name: "Camp John Hay",
    category: "recreational"
  },
  "Bencab Museum": {
    lat: 16.410572,
    lon: 120.550296,
    name: "Bencab Museum",
    category: "museum"
  },
  "Tam-Awan Village": {
    lat: 16.429956,
    lon: 120.576908,
    name: "Tam-Awan Village",
    category: "cultural"
  },

  // Shopping & Markets
  "Baguio Night Market": {
    lat: 16.412099,
    lon: 120.59605,
    name: "Baguio Night Market",
    category: "market"
  },
  "SM City Baguio": {
    lat: 16.408943,
    lon: 120.599174,
    name: "SM City Baguio",
    category: "mall"
  },
  "Baguio Public Market": {
    lat: 16.4153,
    lon: 120.595686,
    name: "Baguio Public Market",
    category: "market"
  },
  "Good Shepherd Convent": {
    lat: 16.422087,
    lon: 120.626227,
    name: "Good Shepherd Convent",
    category: "religious"
  },

  // Nature & Adventure Sites
  "Mirador Heritage and Eco Park": {
    lat: 16.408916,
    lon: 120.581238,
    name: "Mirador Heritage and Eco Park",
    category: "nature"
  },
  "Diplomat Hotel": {
    lat: 16.405921,
    lon: 120.585076,
    name: "Diplomat Hotel",
    category: "historical"
  },
  "Lions Head": {
    lat: 16.358905,
    lon: 120.60392,
    name: "Lions Head",
    category: "viewpoint"
  },
  "Ili-Likha Artists Village": {
    lat: 16.413788,
    lon: 120.59738,
    name: "Ili-Likha Artists Village",
    category: "cultural"
  },
  "Philippine Military Academy": {
    lat: 16.360855,
    lon: 120.619666,
    name: "Philippine Military Academy",
    category: "educational"
  },
  "Great wall of Baguio": {
    lat: 16.369751,
    lon: 120.611562,
    name: "Great wall of Baguio",
    category: "viewpoint"
  },
  "Camp John Hay Yellow Trail": {
    lat: 16.399407,
    lon: 120.615699,
    name: "Camp John Hay Yellow Trail",
    category: "trail"
  },

  // La Trinidad Area (Near Baguio)
  "Valley of Colors": {
    lat: 16.4333,
    lon: 120.597199,
    name: "Valley of Colors",
    category: "cultural"
  },
  "Easter Weaving Room": {
    lat: 16.422626,
    lon: 120.590118,
    name: "Easter Weaving Room",
    category: "cultural"
  },
  "Mt. Kalugong": {
    lat: 16.455,
    lon: 120.5875,
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
