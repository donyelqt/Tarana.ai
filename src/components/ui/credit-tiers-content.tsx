import React from 'react';
import { Check, Zap } from 'lucide-react';
import type { UserTier, TierConfig } from '@/lib/referral-system/types';
import { TIER_CONFIGS } from '@/lib/referral-system/types';

type TierDisplayStatus = 'unlocked' | 'next' | 'locked';

type CreditTiersContentProps = {
  loading?: boolean;
  activeReferrals?: number;
  currentTier?: UserTier;
};

const ORDERED_TIERS: UserTier[] = ['Explorer', 'Smart Traveler', 'Voyager'];

const getOrderedConfigs = (): TierConfig[] =>
  ORDERED_TIERS.map((tier) => TIER_CONFIGS[tier]);

const getBonusCredits = (tierConfig: TierConfig): number => {
  const previousTierDaily =
    tierConfig.name === 'Explorer'
      ? TIER_CONFIGS['Default'].dailyCredits
      : TIER_CONFIGS['Explorer'].dailyCredits;

  if (tierConfig.name === 'Smart Traveler') {
    return tierConfig.dailyCredits - TIER_CONFIGS['Explorer'].dailyCredits;
  }

  if (tierConfig.name === 'Voyager') {
    return tierConfig.dailyCredits - TIER_CONFIGS['Smart Traveler'].dailyCredits;
  }

  return tierConfig.dailyCredits - previousTierDaily;
};

const determineTierStatuses = (referralCount: number): Record<UserTier, TierDisplayStatus> => {
  let nextTierAssigned = false;
  const statuses: Partial<Record<UserTier, TierDisplayStatus>> = {};

  ORDERED_TIERS.forEach((tier) => {
    const required = TIER_CONFIGS[tier].requiredReferrals;

    if (referralCount >= required) {
      statuses[tier] = 'unlocked';
      return;
    }

    if (!nextTierAssigned) {
      statuses[tier] = 'next';
      nextTierAssigned = true;
    } else {
      statuses[tier] = 'locked';
    }
  });

  return statuses as Record<UserTier, TierDisplayStatus>;
};

const getProgressMetadata = (referralCount: number) => {
  const nextTier = ORDERED_TIERS.find(
    (tier) => referralCount < TIER_CONFIGS[tier].requiredReferrals,
  );

  if (!nextTier) {
    const topTierRequirement = TIER_CONFIGS['Voyager'].requiredReferrals;
    return {
      label: `${Math.min(referralCount, topTierRequirement)} / ${topTierRequirement} friends`,
      progress: 100,
      helperText: '🎉 You unlocked every tier!'
    };
  }

  const targetReferrals = TIER_CONFIGS[nextTier].requiredReferrals;
  const progress = Math.min(100, (referralCount / targetReferrals) * 100);
  const remaining = Math.max(0, targetReferrals - referralCount);

  return {
    label: `${referralCount} / ${targetReferrals} friends`,
    progress,
    helperText:
      remaining === 0
        ? 'You are right on the edge—keep inviting friends!'
        : `Invite ${remaining} more friend${remaining === 1 ? '' : 's'} to reach the next tier`,
  };
};

export const CreditTiersContent: React.FC<CreditTiersContentProps> = ({
  loading,
  activeReferrals,
  currentTier,
}) => {
  try {
    if (loading) {
      return (
        <div className="space-y-6">
          <div className="bg-sky-100/60 rounded-xl p-4">
            <div className="bg-white rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-2 bg-gray-200 rounded" />
            </div>
          </div>

          <div className="pb-6">
            <div className="h-9 bg-gray-200 rounded mb-3 w-32" />
            <div className="space-y-3">
              {[1, 2, 3].map((key) => (
                <div key={key} className="rounded-xl p-4 bg-gray-100 animate-pulse">
                  <div className="h-12 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    const referralCount = typeof activeReferrals === 'number' ? activeReferrals : 0;
    const tierStatuses = determineTierStatuses(referralCount);
    const progressMetadata = getProgressMetadata(referralCount);
    const orderedConfigs = getOrderedConfigs();

    return (
      <div className="space-y-6">
        <div className="bg-sky-100/60 rounded-xl p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Credit Tier System</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Invite more friends to unlock higher credit tiers! Credits refresh daily and can be used for Tarana Gala and Tarana Eats.
          </p>

          <div className="bg-white rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">Current Tier Progress</span>
              <span className="text-sm font-medium text-gray-600">{progressMetadata.label}</span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${progressMetadata.progress}%` }}
              />
            </div>

            <p className="text-xs text-gray-600 mt-2">
              {progressMetadata.helperText}
            </p>
          </div>
        </div>

        <div className="pb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Credit Tiers</h3>
          <div className="space-y-3">
            {orderedConfigs.map((tier) => {
              const status = tierStatuses[tier.name];
              const iconElement = status === 'unlocked' ? <Check className="w-5 h-5 text-white" /> : <Zap className="w-5 h-5 text-white" />;
              const bonusCredits = getBonusCredits(tier);

              const styles = (() => {
                switch (status) {
                  case 'unlocked':
                    return {
                      container: 'bg-green-50 border-2 border-green-200',
                      icon: 'bg-green-600',
                      badge: 'bg-green-600 text-white',
                      badgeText: 'Unlocked!',
                    };
                  case 'next':
                    return {
                      container: 'bg-blue-50 border-2 border-blue-200',
                      icon: 'bg-blue-600',
                      badge: 'bg-blue-600 text-white',
                      badgeText: 'Next Tier',
                    };
                  default:
                    return {
                      container: 'bg-white border-2 border-gray-200',
                      icon: 'bg-gray-400',
                      badge: '',
                      badgeText: '',
                    };
                }
              })();

              return (
                <div key={tier.name} className={`rounded-xl p-4 ${styles.container}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${styles.icon}`}>
                      {iconElement}
                    </div>

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
                        +{bonusCredits} daily credits
                      </div>

                      <div className="text-sm font-medium text-gray-700">
                        Total: {tier.dailyCredits} credits/day
                      </div>

                      {status !== 'unlocked' && (
                        <div className="text-sm text-gray-600 mt-2 flex items-center justify-end">
                          <span className="font-medium">{tier.requiredReferrals} Referrals</span>
                        </div>
                      )}

                      {status === 'unlocked' && currentTier === tier.name && (
                        <div className="text-xs text-green-700 mt-2">
                          This is your current tier.
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