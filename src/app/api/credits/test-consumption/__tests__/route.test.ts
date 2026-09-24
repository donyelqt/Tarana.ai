const MockedResponseConsumption = globalThis.Response as unknown as { new(body?: unknown, init?: any): any; json(body: unknown, init?: any): any; };
if (typeof MockedResponseConsumption.json !== 'function') {
  MockedResponseConsumption.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponseConsumption(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getServerSession } from 'next-auth';
import {
  consumeTestCredit,
  getRecentTransactions,
  getUserProfileRow,
} from '@/lib/services/creditDiagnostics';
import { logger } from '@/lib/observability/logger';

jest.mock('@/lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockLogger = logger as jest.Mocked<typeof logger>;

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/services/creditDiagnostics', () => ({
  consumeTestCredit: jest.fn(),
  getRecentTransactions: jest.fn(),
  getUserProfileRow: jest.fn(),
}));

const mockedGetServerSession = getServerSession as unknown as jest.Mock;
const mockedGetUserProfileRow = getUserProfileRow as unknown as jest.Mock;
const mockedConsumeTestCredit = consumeTestCredit as unknown as jest.Mock;
const mockedGetRecentTransactions = getRecentTransactions as unknown as jest.Mock;

function authedRequest(): NextRequest {
  return { headers: { get: () => null } } as unknown as NextRequest;
}

const profileRow = { id: 'user-1', daily_credits: 5, credits_used_today: 0 };

describe('Test Consumption API Route Tests', () => {
  const realNodeEnv = process.env.NODE_ENV;
  const setNodeEnv = (value: string | undefined) => {
    (process.env as Record<string, string | undefined>).NODE_ENV = value;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
  });

  afterEach(() => {
    setNodeEnv(realNodeEnv);
  });

  test('returns 404 in production', async () => {
    setNodeEnv('production');

    const response = await POST(authedRequest());
    expect(response.status).toBe(404);
    expect(mockedGetUserProfileRow).not.toHaveBeenCalled();
  });

  test('fails fast when no profile exists', async () => {
    mockedGetUserProfileRow.mockResolvedValue({ profile: null });

    const response = await POST(authedRequest());

    const body = await response.json();
    expect(body.finalResult).toBe('FAILED - Profile does not exist');
    expect(mockedConsumeTestCredit).not.toHaveBeenCalled();
  });

  test('reports success when the credit is consumed and logged', async () => {
    mockedGetUserProfileRow
      .mockResolvedValueOnce({ profile: profileRow })
      .mockResolvedValueOnce({
        profile: { ...profileRow, credits_used_today: 1 },
      });
    mockedConsumeTestCredit.mockResolvedValue({ data: true });
    mockedGetRecentTransactions.mockResolvedValue({
      transactions: [{ id: 'tx-1' }],
    });

    const response = await POST(authedRequest());

    const body = await response.json();
    expect(body.finalResult).toBe('✅ SUCCESS - Credit system is working!');
    expect(body.summary).toMatchObject({
      balanceBefore: 5,
      balanceAfter: 4,
      creditConsumed: true,
      transactionLogged: true,
    });
    expect(mockedConsumeTestCredit).toHaveBeenCalledWith('user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Attempting to consume test credit',
      expect.objectContaining({ entryPoint: '/api/credits/test-consumption', userId: 'user-1' }),
      expect.any(String)
    );
  });

  test('surfaces the migration hint when the RPC function is missing', async () => {
    mockedGetUserProfileRow.mockResolvedValue({ profile: profileRow });
    mockedConsumeTestCredit.mockResolvedValue({
      data: null,
      error: { message: 'missing', code: '42883' },
    });

    const response = await POST(authedRequest());

    const body = await response.json();
    expect(body.finalResult).toBe('FAILED - consume_credits function error');
    expect(body.recommendation).toBe('Function does not exist - RUN THE MIGRATION!');
  });
});
