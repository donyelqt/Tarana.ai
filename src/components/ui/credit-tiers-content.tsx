import React from 'react';
import { Check, Zap } from 'lucide-react';
import { ProgressIndicator } from './progress-indicator';
import { TierCard } from './tier-card';
import { TIER_CONFIGS, getTierStatus, getNextTier } from '../../lib/credit-tiers';

/**
 * CreditTiersContent component for the credit-tiers TabsContent
 * Displays progress indicator and all three tier cards with proper data and status
 * Uses mock data: 2/3 referrals as specified in requirements
 * Enhanced with accessibility features, responsive design, and error handling
 */
export const CreditTiersContent: React.FC = () => {
  // Mock data as specified in task requirements: 2/3 referrals
  const mockReferralCount = 2;
  
  try {
    // Calculate next tier for progress indicator with error handling
    const nextTier = getNextTier(mockReferralCount);
    const targetReferrals = nextTier ? nextTier.referralsRequired : 5; // Default to max tier if all unlocked
    
    // Calculate progress percentage with validation
    const progressPercentage = nextTier 
      ? Math.min(100, Math.max(0, (mockReferralCount / nextTier.referralsRequired) * 100))
      : 100;

    return (
      <div 
        className="space-y-6 mt-4 px-1 focus-within:outline-none"
        role="main"
        aria-label="Credit tier system information"
        tabIndex={-1}
      >
        {/* Current Tier Progress Section with improved spacing and accessibility */}
        <section aria-labelledby="progress-heading" className="space-y-4">
          <h3 
            id="progress-heading"
            className="text-sm font-semibold text-gray-900 mb-3"
          >
            Current Tier Progress
          </h3>
          <ProgressIndicator
            currentReferrals={mockReferralCount}
            targetReferrals={targetReferrals}
            progressPercentage={progressPercentage}
          />
        </section>

        {/* Credit Tiers Section with improved spacing and accessibility */}
        <section aria-labelledby="tiers-heading" className="space-y-4">
          <h3 
            id="tiers-heading" 
            className="text-sm font-semibold text-gray-900 mb-3 sr-only"
          >
            Available Credit Tiers
          </h3>
          <div className="space-y-4" role="list" aria-label="Credit tier options">
            {TIER_CONFIGS.map((tier, index) => {
              const status = getTierStatus(tier, mockReferralCount);
              
              // Get appropriate icon based on tier and status with error handling
              const getIcon = () => {
                try {
                  if (status === 'unlocked') {
                    return <Check className="w-5 h-5 text-white" aria-hidden="true" />;
                  }
                  return <Zap className="w-5 h-5 text-white" aria-hidden="true" />;
                } catch (error) {
                  console.warn(`Error rendering icon for tier ${tier.id}:`, error);
                  return <div className="w-5 h-5 bg-gray-400 rounded" aria-hidden="true" />;
                }
              };

              return (
                <div key={tier.id} role="listitem">
                  <TierCard
                    tierName={tier.name}
                    dailyCredits={tier.dailyCreditsBonus}
                    totalCredits={tier.totalDailyCredits}
                    referralsRequired={status !== 'unlocked' ? tier.referralsRequired : undefined}
                    status={status}
                    icon={getIcon()}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* Responsive spacing for modal constraints with improved accessibility */}
        <div className="pb-4 sm:pb-6" aria-hidden="true" />
      </div>
    );
  } catch (error) {
    console.error('Error rendering CreditTiersContent:', error);
    
    // Fallback error state with improved styling and accessibility
    return (
      <div 
        className="space-y-4 mt-4 p-6 text-center bg-red-50 border border-red-200 rounded-lg"
        role="alert"
        aria-live="polite"
      >
        <div className="text-sm text-red-800 font-medium">
          Unable to load credit tier information
        </div>
        <div className="text-xs text-red-600">
          Please refresh the page or try again later.
        </div>
      </div>
    );
  }
};

export default CreditTiersContent;