/**
 * Client-side referral tracking utilities
 * Handles storing and processing referral codes during signup
 */

const REFERRAL_STORAGE_KEY = 'pending_referral_code';
const REFERRAL_EXPIRY_KEY = 'pending_referral_expiry';
const REFERRAL_EXPIRY_DAYS = 30; // Referral code valid for 30 days

/**
 * Store referral code from URL parameter
 * Call this when user lands on site with ?ref=CODE
 */
export function storeReferralCode(code: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const trimmedCode = code.trim().toUpperCase();
    
    if (trimmedCode.length === 0) {
      console.warn('Empty referral code provided');
      return;
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + REFERRAL_EXPIRY_DAYS);

    localStorage.setItem(REFERRAL_STORAGE_KEY, trimmedCode);
    localStorage.setItem(REFERRAL_EXPIRY_KEY, expiryDate.toISOString());

    console.log(`📝 Stored referral code: ${trimmedCode} (expires: ${expiryDate.toLocaleDateString()})`);
  } catch (error) {
    console.error('Error storing referral code:', error);
  }
}

/**
 * Get stored referral code if not expired
 * Returns null if no code or expired
 */
export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const code = localStorage.getItem(REFERRAL_STORAGE_KEY);
    const expiryStr = localStorage.getItem(REFERRAL_EXPIRY_KEY);

    if (!code || !expiryStr) {
      return null;
    }

    const expiry = new Date(expiryStr);
    const now = new Date();

    if (now > expiry) {
      console.log('⏰ Referral code expired, clearing...');
      clearReferralCode();
      return null;
    }

    return code;
  } catch (error) {
    console.error('Error getting referral code:', error);
    return null;
  }
}

/**
 * Clear stored referral code
 * Call this after successfully tracking the referral
 */
export function clearReferralCode(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
    localStorage.removeItem(REFERRAL_EXPIRY_KEY);
    console.log('🧹 Cleared referral code from storage');
  } catch (error) {
    console.error('Error clearing referral code:', error);
  }
}

/**
 * Track referral code after successful signup
 * Call this immediately after user signs in for the first time
 */
export async function trackReferralAfterSignup(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const referralCode = getStoredReferralCode();

  if (!referralCode) {
    console.log('ℹ️ No referral code to track (user signed up without referral)');
    return { success: false, message: 'No referral code to track' };
  }

  try {
    console.log(`📡 Tracking referral with code: ${referralCode}`);

    const response = await fetch('/api/auth/track-referral', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ referralCode }),
    });

    console.log(`📊 API Response Status: ${response.status}`);
    
    const data = await response.json();
    console.log(`📊 API Response Data:`, data);

    if (data.success) {
      console.log('✅ Referral tracked successfully!');
      clearReferralCode();
      return { success: true, message: 'Referral tracked successfully' };
    }

    const errorMessage: string = data.error || 'Failed to track referral';
    const isExpectedIssue = ['invalid', 'already', 'self-referral', 'users cannot refer themselves'].some((keyword) =>
      errorMessage.toLowerCase().includes(keyword),
    );

    const logFn = isExpectedIssue ? console.warn : console.error;
    logFn(
      `${isExpectedIssue ? 'ℹ️' : '❌'} Referral tracking issue:`,
      errorMessage,
      data.details ? `Details: ${data.details}` : '',
    );

    if (isExpectedIssue) {
      console.log('🧹 Clearing referral code after expected issue');
      clearReferralCode();
    }

    return {
      success: false,
      error: isExpectedIssue ? undefined : errorMessage,
      message: errorMessage,
    };
  } catch (error: any) {
    console.error('❌ Network error tracking referral:', error);
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Check URL for referral code and store it
 * Call this on initial page load
 */
export function checkAndStoreReferralFromURL(): void {
  if (typeof window === 'undefined') return;

  try {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');

    if (refCode) {
      storeReferralCode(refCode);
      console.log('✅ Referral code detected and stored from URL');
    }
  } catch (error) {
    console.error('Error checking URL for referral code:', error);
  }
}
