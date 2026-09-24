import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { POST } from '../route';
import { logger } from '@/lib/observability/logger';
import { resetHttpMetrics } from '@/lib/observability/httpMetrics';

const MockedResponse = globalThis.Response as unknown as {
  new (body?: unknown, init?: { status?: number; headers?: Record<string, string> }): InstanceType<typeof globalThis.Response>;
  json(body: unknown, init?: { status?: number }): unknown;
};
if (typeof MockedResponse.json !== 'function') {
  MockedResponse.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponse(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
}

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/observability/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const sessionMock = getServerSession as jest.MockedFunction<typeof getServerSession>;
const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const requestId = '11111111-1111-4111-8111-111111111111';

const updatedProfile = {
  active_referrals: 1,
  current_tier: 'Explorer',
  daily_credits: 6,
};

function request(): NextRequest {
  return {
    headers: {
      get: (name: string) => name === 'x-request-id' ? requestId : null,
    },
  } as unknown as NextRequest;
}

function makeSupabase() {
  const referrals = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ data: [{ id: 'referral-1', status: 'active' }], error: null }),
  };
  const profiles = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: updatedProfile, error: null }),
  };

  return {
    from: jest.fn((table: string) => table === 'referrals' ? referrals : profiles),
    referrals,
    profiles,
  };
}

describe('POST /api/referrals/debug', () => {
  let supabase: ReturnType<typeof makeSupabase>;

  let consoleLogSpy: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    resetHttpMetrics();
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    supabase = makeSupabase();
    createClientMock.mockReturnValue(supabase as never);
  });

  it('requires authentication before creating a Supabase client', async () => {
    sessionMock.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(createClientMock).not.toHaveBeenCalled();
  });


  afterEach(() => {
    consoleLogSpy.mockRestore();
  });
  it('updates the tier and logs bounded success metadata', async () => {
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'success',
      message: 'Referral tier updated successfully',
      updated: {
        activeReferrals: 1,
        currentTier: 'Explorer',
        dailyCredits: 6,
      },
      previous: {
        tier: 'Explorer',
        credits: 6,
      },
    });
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      1,
      'Referral tier fix started',
      { entryPoint: '/api/referrals/debug' },
      requestId
    );
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      2,
      'Referral tier fixed',
      {
        entryPoint: '/api/referrals/debug',
        activeReferrals: 1,
        currentTier: 'Explorer',
        dailyCredits: 6,
      },
      requestId
    );
    expect(console.log).not.toHaveBeenCalled();
    expect(JSON.stringify(mockLogger.info.mock.calls)).not.toContain('user-1');
  });

  it('maps profile update failures without logging the raw database error', async () => {
    supabase.profiles.single.mockResolvedValue({ data: null, error: { message: 'SENTINEL_UPDATE_ERROR' } });

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to update profile' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Referrals debug: tier fix failed',
      { entryPoint: '/api/referrals/debug' },
      requestId
    );
    expect(JSON.stringify(mockLogger.error.mock.calls)).not.toContain('SENTINEL_UPDATE_ERROR');
  });
});
