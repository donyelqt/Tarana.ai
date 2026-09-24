/**
 * @jest-environment node
 */
const MockedResponseGen = globalThis.Response as unknown as { new(body?: unknown, init?: { status?: number; headers?: Record<string, string> }): InstanceType<typeof globalThis.Response>; json(body: unknown, init?: { status?: number }): unknown; };
if (typeof MockedResponseGen.json !== 'function') {
  MockedResponseGen.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponseGen(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getServerSession } from 'next-auth';
import { CreditService } from '@/lib/referral-system';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/referral-system', () => ({
  CreditService: {
    consumeCredits: jest.fn(),
    refundCredits: jest.fn(),
    getCurrentBalance: jest.fn(),
  },
  InsufficientCreditsError: class InsufficientCreditsError extends Error {
    required: number;
    available: number;
    constructor(required: number, available: number, service: string) {
      super(`Insufficient credits for ${service}: need ${required}, have ${available}`);
      this.name = 'InsufficientCreditsError';
      this.required = required;
      this.available = available;
    }
  },
}));

jest.mock('@/lib/services/idempotencyService', () => ({
  claimIdempotency: jest.fn(),
  completeIdempotency: jest.fn(),
  hashIdempotencyPayload: jest.fn(() => 'hash-1'),
  getIdempotencyKey: (request: { headers: { get: (k: string) => string | null } }) => {
    const raw = request.headers.get('Idempotency-Key') ?? request.headers.get('X-Idempotency-Key');
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 && trimmed.length <= 256 ? trimmed : null;
  },
}));

jest.mock('@/lib/flags/flags', () => ({
  isFlagEnabled: () => false,
}));

import {
  claimIdempotency,
  completeIdempotency,
} from '@/lib/services/idempotencyService';
const sessionMock = getServerSession as unknown as jest.Mock;
const consumeMock = CreditService.consumeCredits as unknown as jest.Mock;
const balanceMock = CreditService.getCurrentBalance as unknown as jest.Mock;
const claimMock = claimIdempotency as unknown as jest.Mock;
const completeMock = completeIdempotency as unknown as jest.Mock;

const validBody = {
  prompt: 'Baguio highlights for 2 days',
  interests: ['Nature'],
  duration: '2 Days',
  budget: 'Mid',
  pax: '2',
};

function post(body: unknown, headers: Record<string, string> = {}) {
  return {
    headers: { get: (k: string) => headers[k] ?? headers[k.toLowerCase()] ?? null },
    json: async () => body,
    url: 'http://localhost/api/gemini/itinerary-generator',
    nextUrl: { searchParams: new URLSearchParams() },
  } as unknown as NextRequest;
}

describe('itinerary-generator POST idempotency (2.3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    consumeMock.mockResolvedValue({ success: true, remainingCredits: 4 });
    balanceMock.mockResolvedValue({ remainingToday: 5, nextRefresh: 'tomorrow' });
  });

  test('replays the cached response without charging again', async () => {
    claimMock.mockResolvedValue({
      kind: 'replay',
      replay: { status: 200, body: { text: '{"cached":true}' } },
    });

    const out = await POST(post(validBody, { 'Idempotency-Key': 'key-1' }));
    const body = (await out.json()) as { text: string };

    expect(out.status).toBe(200);
    expect(body.text).toBe('{"cached":true}');
    expect(consumeMock).not.toHaveBeenCalled();
  });

  test('answers 409 while a duplicate key is in flight', async () => {
    claimMock.mockResolvedValue({ kind: 'conflict' });

    const out = await POST(post(validBody, { 'Idempotency-Key': 'key-1' }));
    const body = (await out.json()) as { error: string };

    expect(out.status).toBe(409);
    expect(body.error).toBe('Request is already being processed');
    expect(consumeMock).not.toHaveBeenCalled();
  });

  test('answers 422 when the key is reused with a different payload', async () => {
    claimMock.mockResolvedValue({ kind: 'payload-mismatch' });

    const out = await POST(post(validBody, { 'Idempotency-Key': 'key-1' }));

    expect(out.status).toBe(422);
    expect(consumeMock).not.toHaveBeenCalled();
  });

  test('leaves the no-key path untouched (no idempotency machinery runs)', async () => {
    const out = await POST(post({ prompt: '' }));

    // Empty prompt fails validation before any charge or claim.
    expect(out.status).toBe(400);
    expect(claimMock).not.toHaveBeenCalled();
    expect(completeMock).not.toHaveBeenCalled();
  });
});
