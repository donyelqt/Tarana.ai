/**
 * Traffic Color Utilities
 * Provides color coding for traffic levels and congestion visualization
 */

import { TrafficLevel } from '@/types/route-optimization';

export interface TrafficColorScheme {
  color: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  opacity: number;
}

export interface TrafficLevelInfo {
  level: TrafficLevel;
  label: string;
  description: string;
  speedReduction: string;
  colors: TrafficColorScheme;
  icon: string;
}

/**
 * Traffic color mapping based on industry standards
 */
export const TRAFFIC_COLORS: Record<TrafficLevel, TrafficColorScheme> = {
  VERY_LOW: {
    color: '#10b981', // Emerald
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10b981',
    textColor: '#047857',
    opacity: 0.8
  },
  LOW: {
    color: '#22c55e', // Green
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: '#22c55e',
    textColor: '#15803d',
    opacity: 0.8
  },
  MODERATE: {
    color: '#eab308', // Yellow
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderColor: '#eab308',
    textColor: '#a16207',
    opacity: 0.8
  },
  HIGH: {
    color: '#f97316', // Orange
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderColor: '#f97316',
    textColor: '#c2410c',
    opacity: 0.8
  },
  SEVERE: {
    color: '#ef4444', // Red
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#ef4444',
    textColor: '#dc2626',
    opacity: 0.8
  }
};

/**
 * Detailed traffic level information for user awareness
 */
export const TRAFFIC_LEVEL_INFO: Record<TrafficLevel, TrafficLevelInfo> = {
  VERY_LOW: {
    level: 'VERY_LOW',
    label: 'Optimal Flow',
    description: 'Excellent traffic conditions, faster than normal',
    speedReduction: '0% (optimal)',
    colors: TRAFFIC_COLORS.VERY_LOW,
    icon: '🟢'
  },
  LOW: {
    level: 'LOW',
    label: 'Free Flow',
    description: 'Traffic moving at normal speeds',
    speedReduction: '0-15% slower',
    colors: TRAFFIC_COLORS.LOW,
    icon: '🟢'
  },
  MODERATE: {
    level: 'MODERATE',
    label: 'Moderate Traffic',
    description: 'Some congestion, slower than normal',
    speedReduction: '15-40% slower',
    colors: TRAFFIC_COLORS.MODERATE,
    icon: '🟡'
  },
  HIGH: {
    level: 'HIGH',
    label: 'Heavy Traffic',
    description: 'Significant congestion and delays',
    speedReduction: '40-70% slower',
    colors: TRAFFIC_COLORS.HIGH,
    icon: '🟠'
  },
  SEVERE: {
    level: 'SEVERE',
    label: 'Severe Congestion',
    description: 'Stop-and-go or very slow traffic',
    speedReduction: '70%+ slower',
    colors: TRAFFIC_COLORS.SEVERE,
    icon: '🔴'
  }
};

/**
 * Get traffic color based on congestion score (0-100)
 */
export function getTrafficColorFromScore(congestionScore: number): TrafficColorScheme {
  if (congestionScore >= 80) return TRAFFIC_COLORS.SEVERE;
  if (congestionScore >= 60) return TRAFFIC_COLORS.HIGH;
  if (congestionScore >= 30) return TRAFFIC_COLORS.MODERATE;
  if (congestionScore >= 15) return TRAFFIC_COLORS.LOW;
  return TRAFFIC_COLORS.VERY_LOW;
}

/**
 * Get traffic level from congestion score
 */
export function getTrafficLevelFromScore(congestionScore: number): TrafficLevel {
  if (congestionScore >= 80) return 'SEVERE';
  if (congestionScore >= 60) return 'HIGH';
  if (congestionScore >= 30) return 'MODERATE';
  if (congestionScore >= 15) return 'LOW';
  return 'VERY_LOW';
}

/**
 * Get map polyline style for traffic visualization
 */
export function getTrafficPolylineStyle(trafficLevel: TrafficLevel, weight: number = 6): {
  color: string;
  weight: number;
  opacity: number;
  dashArray?: string;
} {
  const colors = TRAFFIC_COLORS[trafficLevel];
  
  return {
    color: colors.color,
    weight,
    opacity: colors.opacity,
    // Add dashed lines for severe traffic
    ...(trafficLevel === 'SEVERE' && { dashArray: '10, 5' })
  };
}

/**
 * Get CSS classes for traffic level styling
 */
export function getTrafficLevelClasses(trafficLevel: TrafficLevel): string {
  const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
  
  switch (trafficLevel) {
    case 'VERY_LOW':
      return `${baseClasses} bg-emerald-100 text-emerald-800 border border-emerald-200`;
    case 'LOW':
      return `${baseClasses} bg-green-100 text-green-800 border border-green-200`;
    case 'MODERATE':
      return `${baseClasses} bg-yellow-100 text-yellow-800 border border-yellow-200`;
    case 'HIGH':
      return `${baseClasses} bg-orange-100 text-orange-800 border border-orange-200`;
    case 'SEVERE':
      return `${baseClasses} bg-red-100 text-red-800 border border-red-200`;
    default:
      return `${baseClasses} bg-gray-100 text-gray-800 border border-gray-200`;
  }
}

/**
 * Get traffic recommendation message based on level
 */
export function getTrafficRecommendation(trafficLevel: TrafficLevel): {
  message: string;
  action: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
} {
  switch (trafficLevel) {
    case 'VERY_LOW':
      return {
        message: 'Excellent travel conditions',
        action: 'Perfect time to travel',
        priority: 'low'
      };
    case 'LOW':
      return {
        message: 'Optimal travel conditions',
        action: 'Proceed with confidence',
        priority: 'low'
      };
    case 'MODERATE':
      return {
        message: 'Some delays expected',
        action: 'Consider alternative routes',
        priority: 'medium'
      };
    case 'HIGH':
      return {
        message: 'Significant delays likely',
        action: 'Strongly consider alternatives',
        priority: 'high'
      };
    case 'SEVERE':
      return {
        message: 'Major congestion ahead',
        action: 'Avoid this route if possible',
        priority: 'critical'
      };
    default:
      return {
        message: 'Traffic conditions unknown',
        action: 'Proceed with caution',
        priority: 'medium'
      };
  }
}

/**
 * Format traffic delay for display
 */
export function formatTrafficDelay(delaySeconds: number): string {
  if (delaySeconds < 60) {
    return `${Math.round(delaySeconds)}s delay`;
  }
  
  const minutes = Math.round(delaySeconds / 60);
  if (minutes < 60) {
    return `${minutes}min delay`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}min delay`;
}

/**
 * Get traffic intensity percentage for visual indicators
 */
export function getTrafficIntensity(trafficLevel: TrafficLevel): number {
  switch (trafficLevel) {
    case 'VERY_LOW': return 5;
    case 'LOW': return 20;
    case 'MODERATE': return 50;
    case 'HIGH': return 75;
    case 'SEVERE': return 95;
    default: return 0;
  }
}
