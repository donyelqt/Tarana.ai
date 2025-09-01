/**
 * Image utility functions for handling image paths and fallbacks
 */

/**
 * Normalizes image paths to ensure they work with Next.js Image component
 * Converts relative paths to absolute paths starting with "/"
 */
export function normalizeImagePath(imagePath: string | undefined | null): string {
  if (!imagePath || typeof imagePath !== 'string') {
    return getFallbackImage();
  }

  // If it's already an absolute URL (http/https), return as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // If it already starts with "/", return as-is
  if (imagePath.startsWith('/')) {
    return imagePath;
  }

  // Convert relative path to absolute path
  return `/${imagePath}`;
}

/**
 * Validates if an image path is in the correct format for Next.js Image component
 */
export function isValidImagePath(imagePath: string): boolean {
  if (!imagePath || typeof imagePath !== 'string') {
    return false;
  }

  // Valid if it's an absolute URL or starts with "/"
  return imagePath.startsWith('http://') || 
         imagePath.startsWith('https://') || 
         imagePath.startsWith('/');
}

/**
 * Gets a fallback image based on activity tags or returns default
 */
export function getFallbackImage(tags?: string[]): string {
  if (!tags || tags.length === 0) {
    return '/images/placeholders/default-itinerary.jpg';
  }

  const primaryCategory = getPrimaryCategoryFromTags(tags);
  
  switch (primaryCategory) {
    case 'nature':
      return '/images/placeholders/nature-placeholder.jpg';
    case 'food':
      return '/images/placeholders/food-placeholder.jpg';
    case 'culture':
      return '/images/placeholders/culture-placeholder.jpg';
    case 'adventure':
      return '/images/placeholders/adventure-placeholder.jpg';
    default:
      return '/images/placeholders/default-itinerary.jpg';
  }
}

/**
 * Determines the primary category from activity tags
 */
export function getPrimaryCategoryFromTags(tags: string[]): string {
  const categoryMap: { [key: string]: string[] } = {
    nature: ['nature', 'outdoor', 'hiking', 'mountain', 'beach', 'park', 'scenic', 'waterfall'],
    food: ['food', 'restaurant', 'dining', 'cuisine', 'local food', 'street food', 'cafe'],
    culture: ['culture', 'historical', 'museum', 'heritage', 'traditional', 'art', 'religious'],
    adventure: ['adventure', 'extreme', 'sports', 'climbing', 'diving', 'surfing', 'trekking']
  };

  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (tags.some(tag => keywords.some(keyword => 
      tag.toLowerCase().includes(keyword.toLowerCase())
    ))) {
      return category;
    }
  }

  return 'default';
}
