/**
 * Regression: no API route may leak raw error details (.message, .details,
 * .stack, .code, or upstream error object shape) into a JSON response body.
 *
 * Each test forces a service-layer rejection with a message containing a
 * sentinel string. We assert the response body does NOT contain that sentinel
 * and does NOT expose detail-leak fields.
 */
import { NextRequest } from 'next/server';

const MockedResponsePolyfill = globalThis.Response as unknown as {
  new (body?: unknown, init?: { status?: number; headers?: Record<string, string> }): InstanceType<typeof globalThis.Response>;
  json(body: unknown, init?: { status?: number }): unknown;
};
if (typeof MockedResponsePolyfill.json !== 'function') {
  MockedResponsePolyfill.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponsePolyfill(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

// Sentinel suffix that must NEVER appear in a client response body.
const SENTINEL = 'SUPER_SECRET_INTERNAL_DETAIL_xyz789';

function makeRequest(): NextRequest {
  return { headers: { get: () => null } } as unknown as NextRequest;
}

async function bodyText(res: { json: () => Promise<unknown> }): Promise<string> {
  return JSON.stringify(await res.json());
}

// ── Mock shared deps ─────────────────────────────────────────────────
jest.mock('@/lib/referral-system', () => ({
  ReferralService: { validateReferralCode: jest.fn() },
  TierService: { getAllTiers: jest.fn() },
}));
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/services/mealService', () => ({
  listMeals: jest.fn(),
  createMeal: jest.fn(),
  MealDbError: class MealDbError extends Error {
    details: string;
    hint?: string;
    code?: string;
    constructor(details: string, hint?: string, code?: string) {
      super(`Failed to fetch saved meals: ${details}`);
      this.name = 'MealDbError';
      this.details = details;
      this.hint = hint;
      this.code = code;
    }
  },
}));

import { ReferralService, TierService } from '@/lib/referral-system';
import { getServerSession } from 'next-auth';
import { listMeals, MealDbError } from '@/lib/services/mealService';
import { POST as ValidatePOST } from './referrals/validate/route';
import { GET as TiersGET } from './tiers/all/route';
import { GET as SavedMealsGET } from './saved-meals/route';

// ── referrals/validate ────────────────────────────────────────────────
describe('referrals/validate: no raw error leakage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not leak error.message on ReferralService failure', async () => {
    (ReferralService.validateReferralCode as jest.Mock).mockRejectedValue(new Error(`boom ${SENTINEL}`));

    const res = await ValidatePOST({
      headers: { get: () => null },
      json: async () => ({ code: 'ABC123' }),
    } as unknown as NextRequest);

    const text = await bodyText(res);
    expect(text).not.toContain(SENTINEL);
    expect(text).not.toContain('details');
    expect(text).not.toContain('stack');
  });
});

// ── tiers/all ─────────────────────────────────────────────────────────
describe('tiers/all: no raw error leakage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not leak error.message on TierService failure', async () => {
    // getAllTiers is synchronous — throw synchronously inside the try/catch.
    (TierService.getAllTiers as jest.Mock).mockImplementation(() => {
      throw new Error(`fail ${SENTINEL}`);
    });

    const res = await TiersGET(makeRequest());
    const text = await bodyText(res);
    expect(text).not.toContain(SENTINEL);
    expect(text).not.toContain('details');
    expect(text).not.toContain('stack');
  });
});

// ── saved-meals ───────────────────────────────────────────────────────
describe('saved-meals: no MealDbError field leakage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('does not leak details/hint/code on MealDbError', async () => {
    (listMeals as jest.Mock).mockRejectedValue(
      new MealDbError(`db ${SENTINEL}`, 'secret-hint', 'PGRST999')
    );

    const res = await SavedMealsGET(makeRequest());
    const text = await bodyText(res);
    expect(text).not.toContain(SENTINEL);
    expect(text).not.toContain('secret-hint');
    expect(text).not.toContain('PGRST999');
  });
});
