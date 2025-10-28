import React from 'react';
import { Check, Zap } from 'lucide-react';
import { TIER_CONFIGS, getTierStatus, getNextTier } from '../../lib/credit-tiers';

/**
 * CreditTiersContent component redesigned to match UI reference
 * Features header section, progress indicator, and tier cards with proper styling
 */
export const CreditTiersContent: React.FC = () => {
  const mockReferralCount = 2;
  
  try {
    const nextTier = getNextTier(mockReferralCount);
    const targetReferrals = nextTier ? nextTier.referralsRequired : 5;
    const progressPercentage = nextTier 
      ? Math.min(100, Math.max(0, (mockReferralCount / nextTier.referralsRequired) * 100))
      : 100;

    return (
      <div className="space-y-6">
        {/* Credit Tier System Container with Sky Blue Background */}
        <div className="bg-sky-100/60 rounded-xl p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Credit Tier System</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Invite more friends to unlock higher credit tiers! Credits refresh daily and can be used for Tarana Gala and Tarana Eats.
          </p>

          {/* Current Tier Progress - White Background Container */}
          <div className="bg-white rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">Current Tier Progress</span>
              <span className="text-sm font-medium text-gray-600">{mockReferralCount} / {targetReferrals} friends</span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Credit Tiers */}
        <div className="pb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Credit Tiers</h3>
          <div className="space-y-3">
            {TIER_CONFIGS.map((tier) => {
              const status = getTierStatus(tier, mockReferralCount);
              
              // Determine card styling based on status
              const getCardStyles = () => {
                switch (status) {
                  case 'unlocked':
                    return {
                      container: 'bg-green-50 border-2 border-green-200',
                      icon: 'bg-green-600',
                      iconElement: <Check className="w-5 h-5 text-white" />,
                      badge: 'bg-green-600 text-white',
                      badgeText: 'Unlocked!'
                    };
                  case 'next':
                    return {
                      container: 'bg-blue-50 border-2 border-blue-200',
                      icon: 'bg-blue-600',
                      iconElement: <Zap className="w-5 h-5 text-white" />,
                      badge: 'bg-blue-600 text-white',
                      badgeText: 'Next Tier'
                    };
                  default:
                    return {
                      container: 'bg-white border-2 border-gray-200',
                      icon: 'bg-gray-400',
                      iconElement: <Zap className="w-5 h-5 text-white" />,
                      badge: '',
                      badgeText: ''
                    };
                }
              };

              const styles = getCardStyles();

              return (
                <div key={tier.id} className={`rounded-xl p-4 ${styles.container}`}>
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${styles.icon}`}>
                      {styles.iconElement}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-base font-semibold text-gray-900">{tier.name}</h4>
                        {styles.badgeText && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles.badge}`}>
                            {styles.badgeText}
                          </span>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-1">
                        +{tier.dailyCreditsBonus} daily credits
                      </div>
                      
                      <div className="text-sm font-medium text-gray-700">
                        Total: {tier.totalDailyCredits} credits/day
                      </div>
                      
                      {status !== 'unlocked' && (
                        <div className="text-sm text-gray-600 mt-2 flex items-center justify-end">
                          <span className="font-medium">{tier.referralsRequired} Referrals</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error rendering CreditTiersContent:', error);
    
    return (
      <div className="space-y-4 p-6 text-center bg-red-50 border border-red-200 rounded-lg">
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