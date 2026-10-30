
export function normalizeImagePath(imagePath: string | undefined | null): string {
  if (!imagePath || typeof imagePath !== 'string') {
    return getFallbackImage();
  }

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  if (imagePath.startsWith('/')) {
    return imagePath;
  }

  return `/${imagePath}`;
}

export function isValidImagePath(imagePath: string): boolean {
  if (!imagePath || typeof imagePath !== 'string') {
    return false;
  }

  return imagePath.startsWith('http://') || 
         imagePath.startsWith('https://') || 
         imagePath.startsWith('/');
}

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
