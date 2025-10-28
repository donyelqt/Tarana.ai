import React from 'react';
import { Check, Zap } from 'lucide-react';
import { TierCardProps } from '../../types/credit-tiers';

/**
 * TierCard component for displaying individual credit tiers
 * Implements three visual states: unlocked (green), next (blue), locked (gray)
 * Matches design specifications: 12px border radius, 16px padding, proper typography
 * Enhanced with accessibility features, improved color contrast, and error handling
 */
export const TierCard: React.FC<TierCardProps> = ({
  tierName,
  dailyCredits,
  totalCredits,
  referralsRequired,
  status,
  icon
}) => {
  // Validate props with comprehensive error handling
  if (!tierName || typeof tierName !== 'string' || tierName.trim().length === 0) {
    console.warn('TierCard: Invalid tierName provided:', tierName);
    return null;
  }
  
  if (typeof dailyCredits !== 'number' || dailyCredits < 0 || !isFinite(dailyCredits)) {
    console.warn('TierCard: Invalid dailyCredits provided:', dailyCredits);
    return null;
  }
  
  if (typeof totalCredits !== 'number' || totalCredits < 0 || !isFinite(totalCredits)) {
    console.warn('TierCard: Invalid totalCredits provided:', totalCredits);
    return null;
  }
  
  if (!['unlocked', 'next', 'locked'].includes(status)) {
    console.warn('TierCard: Invalid status provided:', status);
    return null;
  }

  // Color schemes based on tier status with improved contrast ratios for accessibility
  const getStatusStyles = () => {
    switch (status) {
      case 'unlocked':
        return {
          background: 'bg-green-50',
          border: 'border-green-700', // Enhanced contrast for accessibility
          iconBg: 'bg-green-700',
          statusBadge: 'bg-green-700 text-white',
          textColor: 'text-green-900',
          hoverEffect: 'hover:bg-green-100'
        };
      case 'next':
        return {
          background: 'bg-blue-50',
          border: 'border-blue-700', // Enhanced contrast for accessibility
          iconBg: 'bg-blue-700',
          statusBadge: 'bg-blue-700 text-white',
          textColor: 'text-blue-900',
          hoverEffect: 'hover:bg-blue-100'
        };
      case 'locked':
        return {
          background: 'bg-gray-50',
          border: 'border-gray-500', // Enhanced contrast for accessibility
          iconBg: 'bg-gray-600',
          statusBadge: '',
          textColor: 'text-gray-800',
          hoverEffect: 'hover:bg-gray-100'
        };
      default:
        return {
          background: 'bg-gray-50',
          border: 'border-gray-500',
          iconBg: 'bg-gray-600',
          statusBadge: '',
          textColor: 'text-gray-800',
          hoverEffect: 'hover:bg-gray-100'
        };
    }
  };

  const styles = getStatusStyles();

  // Get the appropriate icon with error handling
  const getIcon = () => {
    try {
      if (React.isValidElement(icon)) {
        return icon;
      }
      
      // Fallback to default icons if needed
      if (status === 'unlocked') {
        return <Check className="w-5 h-5 text-white" aria-hidden="true" />;
      }
      return <Zap className="w-5 h-5 text-white" aria-hidden="true" />;
    } catch (error) {
      console.warn('TierCard: Error rendering icon', error);
      return <div className="w-5 h-5" aria-hidden="true" />;
    }
  };

  // Get status badge text
  const getStatusBadgeText = () => {
    switch (status) {
      case 'unlocked':
        return 'Unlocked!';
      case 'next':
        return 'Next Tier';
      default:
        return null;
    }
  };

  const statusBadgeText = getStatusBadgeText();

  // Generate accessible description
  const getAriaLabel = () => {
    const baseDescription = `${tierName} tier: ${dailyCredits} daily credits bonus, ${totalCredits} total credits per day`;
    if (status === 'unlocked') {
      return `${baseDescription}. This tier is unlocked.`;
    }
    if (status === 'next' && referralsRequired) {
      return `${baseDescription}. Next tier requiring ${referralsRequired} referrals.`;
    }
    if (referralsRequired) {
      return `${baseDescription}. Requires ${referralsRequired} referrals to unlock.`;
    }
    return baseDescription;
  };

  return (
    <div 
      className={`
        w-full rounded-xl border-2 p-4 sm:p-5 transition-all duration-200 hover:shadow-md focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-600
        ${styles.background} ${styles.border} ${styles.hoverEffect}
      `}
      role="article"
      aria-label={getAriaLabel()}
      tabIndex={0}
    >
      <div className="flex items-start gap-4">
        {/* Icon container - 40px × 40px with improved accessibility and design specs */}
        <div 
          className={`
            w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm transition-colors duration-200
            ${styles.iconBg}
          `}
          aria-hidden="true"
        >
          {getIcon()}
        </div>

        {/* Content section */}
        <div className="flex-1 min-w-0">
          {/* Tier name and status badge row */}
          <div className="flex items-center justify-between mb-3">
            {/* Tier name - 16px font-semibold with improved contrast */}
            <h3 className={`text-base font-semibold truncate ${styles.textColor}`}>
              {tierName}
            </h3>
            
            {/* Status badge with improved accessibility */}
            {statusBadgeText && (
              <span 
                className={`
                  px-3 py-1 rounded-full text-xs font-medium shadow-sm
                  ${styles.statusBadge}
                `}
                aria-label={`Status: ${statusBadgeText}`}
              >
                {statusBadgeText}
              </span>
            )}
          </div>

          {/* Credits information - 14px font-medium with improved spacing and contrast */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">
              +{dailyCredits} daily credits
            </div>
            <div className="text-sm font-medium text-gray-800">
              Total: {totalCredits} credits/day
            </div>
            
            {/* Referrals required (only for locked/next tiers) */}
            {referralsRequired !== undefined && status !== 'unlocked' && (
              <div className="text-sm font-medium text-gray-700 mt-3 pt-2 border-t border-gray-300">
                <span className="inline-flex items-center gap-1">
                  <span className="text-gray-600">{referralsRequired}</span>
                  <span>Referrals required</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TierCard;