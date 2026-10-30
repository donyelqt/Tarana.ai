'use client';

import { useEffect } from 'react';
import { checkAndStoreReferralFromURL } from '@/lib/referral-system/client/referralTracking';

export function ReferralTracker() {
  useEffect(() => {
    checkAndStoreReferralFromURL();
  }, []);

  return null; 
}
