const MockedResponseDiagnostics = globalThis.Response as unknown as { new(body?: unknown, init?: any): any; json(body: unknown, init?: any): any; };
if (typeof MockedResponseDiagnostics.json !== 'function') {
  MockedResponseDiagnostics.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponseDiagnostics(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { getServerSession } from 'next-auth';
import { createUserProfile } from '@/lib/services/userService';
import {
  checkConsumeCreditsFunction,
  checkTableExists,
  getRecentTransactions,
  getUserProfileRow,
} from '@/lib/services/creditDiagnostics';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/services/userService', () => ({
  createUserProfile: jest.fn(),
}));

jest.mock('@/lib/services/creditDiagnostics', () => ({
  checkConsumeCreditsFunction: jest.fn(),
  checkTableExists: jest.fn(),
  getRecentTransactions: jest.fn(),
  getUserProfileRow: jest.fn(),
}));

const mockedGetServerSession = getServerSession as unknown as jest.Mock;
const mockedCreateUserProfile = createUserProfile as unknown as jest.Mock;
const mockedCheckTableExists = checkTableExists as unknown as jest.Mock;
const mockedGetUserProfileRow = getUserProfileRow as unknown as jest.Mock;
const mockedCheckConsumeCreditsFunction = checkConsumeCreditsFunction as unknown as jest.Mock;
const mockedGetRecentTransactions = getRecentTransactions as unknown as jest.Mock;

function authedRequest(): NextRequest {
  return { headers: { get: () => null } } as unknown as NextRequest;
}

const profileRow = { id: 'user-1', daily_credits: 5, credits_used_today: 0 };

describe('Diagnostics API Route Tests', () => {
  const realNodeEnv = process.env.NODE_ENV;
  const setNodeEnv = (value: string | undefined) => {
    (process.env as Record<string, string | undefined>).NODE_ENV = value;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockedCheckTableExists.mockResolvedValue({ exists: true });
    mockedGetUserProfileRow.mockResolvedValue({ profile: profileRow });
    mockedCheckConsumeCreditsFunction.mockResolvedValue({ exists: true });
    mockedGetRecentTransactions.mockResolvedValue({ transactions: [] });
  });

  afterEach(() => {
    setNodeEnv(realNodeEnv);
  });

  test('returns 404 in production', async () => {
    setNodeEnv('production');

    const response = await GET(authedRequest());
    expect(response.status).toBe(404);
    expect(mockedCheckTableExists).not.toHaveBeenCalled();
  });

  test('assembles all checks for a healthy system', async () => {
    const response = await GET(authedRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.checks).toMatchObject({
      userProfilesTableExists: true,
      userProfileExists: true,
      creditTransactionsTableExists: true,
      consumeCreditsFunctionExists: true,
    });
    expect(body.summary).toMatchObject({ migrationRun: true, readyToUse: true, errorCount: 0 });
    expect(mockedCreateUserProfile).not.toHaveBeenCalled();
  });

  test('treats PGRST116 no-rows as absent profile, not an error', async () => {
    mockedGetUserProfileRow.mockResolvedValue({
      profile: null,
      error: { message: 'no rows', code: 'PGRST116' },
    });

    const response = await GET(authedRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.checks.userProfileExists).toBe(false);
    expect(body.errors).toHaveLength(0);
  });

  test('creates the profile when missing and marks setup complete', async () => {
    mockedGetUserProfileRow.mockResolvedValue({ profile: null });
    mockedCreateUserProfile.mockResolvedValue(undefined);

    const response = await GET(authedRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(mockedCreateUserProfile).toHaveBeenCalledWith('user-1');
    expect(body.checks.profileCreated).toBe(true);
    expect(body.summary.userSetup).toBe(true);
  });

  test('records a failed table check as an error', async () => {
    mockedCheckTableExists.mockImplementation((table: string) =>
      table === 'credit_transactions'
        ? Promise.resolve({ exists: false, error: { message: 'denied' } })
        : Promise.resolve({ exists: true })
    );

    const response = await GET(authedRequest());

    const body = await response.json();
    expect(body.checks.creditTransactionsTableExists).toBe(false);
    expect(body.errors).toContain('credit_transactions table error: denied');
    expect(body.summary.errorCount).toBe(1);
  });
});
