
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

export const TRAFFIC_COLORS: Record<TrafficLevel, TrafficColorScheme> = {
  VERY_LOW: {
    color: '#10b981', 
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10b981',
    textColor: '#047857',
    opacity: 0.8
  },
  LOW: {
    color: '#22c55e', 
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: '#22c55e',
    textColor: '#15803d',
    opacity: 0.8
  },
  MODERATE: {
    color: '#eab308', 
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderColor: '#eab308',
    textColor: '#a16207',
    opacity: 0.8
  },
  HIGH: {
    color: '#f97316', 
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderColor: '#f97316',
    textColor: '#c2410c',
    opacity: 0.8
  },
  SEVERE: {
    color: '#ef4444', 
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#ef4444',
    textColor: '#dc2626',
    opacity: 0.8
  }
};

export const TRAFFIC_LEVEL_INFO: Record<TrafficLevel, TrafficLevelInfo> = {
  VERY_LOW: {
    level: 'VERY_LOW',
    label: 'Low',
    description: 'Excellent traffic conditions, faster than normal',
    speedReduction: '0% (optimal)',
    colors: TRAFFIC_COLORS.LOW,
    icon: '🟢'
  },
  LOW: {
    level: 'LOW',
    label: 'Low',
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

export function getTrafficColorFromScore(congestionScore: number): TrafficColorScheme {
  if (congestionScore >= 75) return TRAFFIC_COLORS.SEVERE;
  if (congestionScore >= 50) return TRAFFIC_COLORS.HIGH;
  if (congestionScore >= 25) return TRAFFIC_COLORS.MODERATE;
  if (congestionScore >= 15) return TRAFFIC_COLORS.LOW;
  return TRAFFIC_COLORS.VERY_LOW;
}

export function getTrafficLevelFromScore(congestionScore: number): TrafficLevel {
  if (congestionScore >= 75) return 'SEVERE';
  if (congestionScore >= 50) return 'HIGH';
  if (congestionScore >= 25) return 'MODERATE';
  if (congestionScore >= 15) return 'LOW';
  return 'VERY_LOW';
}

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
    ...(trafficLevel === 'SEVERE' && { dashArray: '10, 5' })
  };
}

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

export const LEGEND_TRAFFIC_LEVELS = [
  TRAFFIC_LEVEL_INFO.LOW,
  TRAFFIC_LEVEL_INFO.MODERATE,
  TRAFFIC_LEVEL_INFO.HIGH,
  TRAFFIC_LEVEL_INFO.SEVERE
];
