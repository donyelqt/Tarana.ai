const MockedResponseConsent = globalThis.Response as unknown as { new(body?: unknown, init?: any): any; json(body: unknown, init?: any): any; };
if (typeof MockedResponseConsent.json !== 'function') {
  MockedResponseConsent.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponseConsent(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getServerSession } from 'next-auth';
import { recordTosAcceptance } from '@/lib/services/userService';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/services/userService', () => ({
  recordTosAcceptance: jest.fn(),
}));

const mockedGetServerSession = getServerSession as unknown as jest.Mock;
const mockedRecordTosAcceptance = recordTosAcceptance as unknown as jest.Mock;

function makeRequest(): NextRequest {
  return { headers: { get: () => null } } as unknown as NextRequest;
}

describe('Consent API Route Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRecordTosAcceptance.mockResolvedValue(undefined);
  });

  test('rejects unauthenticated requests with 401', async () => {
    mockedGetServerSession.mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
    expect(mockedRecordTosAcceptance).not.toHaveBeenCalled();
  });

  test('sets tos_accepted_at for the session user', async () => {
    mockedGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(typeof body.tos_accepted_at).toBe('string');

    expect(mockedRecordTosAcceptance).toHaveBeenCalledWith('user-1');
  });

  test('returns 500 when the timestamp update fails', async () => {
    mockedGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockedRecordTosAcceptance.mockRejectedValue(new Error('db down'));

    const response = await POST(makeRequest());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });
});