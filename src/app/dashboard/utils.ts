import { TIER_CONFIGS } from '@/lib/referral-system/types';

/**
 * View model for the dashboard referral widget. `nextTier` is null once the
 * user reaches the top tier (Voyager) — the render layer treats that as maxed.
 */
export interface ReferralStatsView {
  activeReferrals: number;
  currentTier: string;
  nextTier: string | null;
  nextTierRequirement: number | null;
  progress: number | null;
}

export interface ReferralDisplay {
  current: number;
  tier: string;
  isMaxed: boolean;
  /** e.g. "1/3". Never overflows: maxed users see "10/10", not "10/5". */
  label: string;
  nextTierName: string;
  nextBenefit: string;
  progress: number;
  invitesNeeded: number;
}

/**
 * Map a raw /api/referrals/stats payload to the dashboard view model.
 * Returns null for any shape that lacks usable stats — the widget then keeps
 * showing its loading state instead of crashing on undefined fields.
 */
export function mapReferralStatsResponse(input: unknown): ReferralStatsView | null {
  if (!input || typeof input !== 'object') return null;
  const d = input as {
    success?: unknown;
    stats?: unknown;
    tierProgress?: unknown;
  };
  if (d.success !== true) return null;
  if (!d.stats || typeof d.stats !== 'object') return null;

  const stats = d.stats as { activeReferrals?: unknown; currentTier?: unknown };
  const tp = (d.tierProgress ?? {}) as {
    nextTier?: unknown;
    nextTierRequirement?: unknown;
    progress?: unknown;
  };

  return {
    activeReferrals:
      typeof stats.activeReferrals === 'number' ? stats.activeReferrals : 0,
    currentTier:
      typeof stats.currentTier === 'string' ? stats.currentTier : 'Default',
    nextTier: typeof tp.nextTier === 'string' ? tp.nextTier : null,
    nextTierRequirement:
      typeof tp.nextTierRequirement === 'number' ? tp.nextTierRequirement : null,
    progress: typeof tp.progress === 'number' ? tp.progress : null,
  };
}

/**
 * Derive widget copy from the server-provided tierProgress. Thresholds and
 * benefits come from TIER_CONFIGS (single source of truth) — no hardcoded
 * 1/3/5 ladder in the render layer.
 */
export function getReferralDisplay(view: ReferralStatsView): ReferralDisplay {
  const isMaxed = view.nextTier == null;
  const nextTarget = view.nextTierRequirement ?? view.activeReferrals;
  const progress =
    view.progress ??
    (isMaxed || nextTarget <= 0
      ? 100
      : Math.min((view.activeReferrals / nextTarget) * 100, 100));

  let nextBenefit = 'Max tier reached!';
  if (!isMaxed && view.nextTier) {
    const cfg = (TIER_CONFIGS as Record<string, { dailyCredits: number }>)[
      view.nextTier
    ];
    nextBenefit = cfg ? `${cfg.dailyCredits} credits/day` : '';
  }

  return {
    current: view.activeReferrals,
    tier: view.currentTier,
    isMaxed,
    label: `${view.activeReferrals}/${nextTarget}`,
    nextTierName: view.nextTier ?? view.currentTier,
    nextBenefit,
    progress,
    invitesNeeded: isMaxed ? 0 : Math.max(nextTarget - view.activeReferrals, 0),
  };
}

/** True only when the weather payload is the offline fallback (utils.ts). */
export function isFallbackWeather(
  w: { isFallback?: boolean } | null | undefined
): boolean {
  return w?.isFallback === true;
}
