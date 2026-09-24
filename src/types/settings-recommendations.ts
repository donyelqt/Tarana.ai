export type SettingsRecommendationKind = 'cafe' | 'spot';
export type SettingsTrafficLevel = 'Low' | 'Moderate' | 'High';

export interface SettingsRecommendationCard {
  name: string;
  image: string | null;
  distance: string;
  time: string;
  traffic?: SettingsTrafficLevel;
}

export interface SettingsRecommendation {
  kind: SettingsRecommendationKind;
  card: SettingsRecommendationCard;
  href: string;
  action: string;
  context: string;
}

export interface SettingsRecommendationsResponse {
  success: true;
  personalized: boolean;
  personalizationError?: boolean;
  recommendations: SettingsRecommendation[];
}
