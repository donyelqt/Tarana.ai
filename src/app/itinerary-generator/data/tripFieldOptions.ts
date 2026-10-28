import { PiggyBank, Wallet, CreditCard, Gem, DollarSign } from 'lucide-react';

/**
 * Canonical vocabulary for trip form fields that several surfaces share.
 *
 * `itineraryData.ts` still owns the activity catalog; this file owns the
 * field-level options so a screen that only needs the vocabulary does not
 * have to load the catalog. `itineraryData.ts` re-exports them back out.
 */

export const budgetOptions = [
  'less than ₱3,000/day',
  '₱3,000 - ₱5,000/day',
  '₱5,000 - ₱10,000/day',
  '₱10,000+/day',
];

/**
 * Icon shown beside each canonical budget tier, by position.
 *
 * Gala's `ItineraryForm` maps the same icons by index via a switch; this array
 * exists so the saved-trips editor can render the same dropdown without
 * coupling to Gala's exact render logic. A non-canonical budget string (one the
 * row got from somewhere else) falls back to `DollarSign`, which is index 4.
 */
export const BUDGET_ICONS = [PiggyBank, Wallet, CreditCard, Gem, DollarSign];

export const interestLabels = [
  'Random',
  'Nature & Scenery',
  'Food & Culinary',
  'Culture & Arts',
  'Shopping & Local Finds',
  'Adventure',
];
