'use client';

import { useEffect } from 'react';
import { checkAndStoreReferralFromURL } from '@/lib/referral-system/client/referralTracking';

/**
 * Client component to check for referral codes in URL
 * Add this to your root layout
 */
export function ReferralTracker() {
  useEffect(() => {
    // Check URL for ?ref=CODE parameter and store it
    checkAndStoreReferralFromURL();
  }, []);

  return null; // This component doesn't render anything
}
