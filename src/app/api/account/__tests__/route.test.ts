const MockedResponseAccount = globalThis.Response as unknown as { new(body?: unknown, init?: { status?: number; headers?: Record<string, string> }): any; json(body: unknown, init?: { status?: number }): any; };
if (typeof MockedResponseAccount.json !== 'function') {
  MockedResponseAccount.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponseAccount(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

import { NextRequest } from 'next/server';
import { DELETE } from '../route';
import { getServerSession } from 'next-auth';
import { deleteUserAccount } from '@/lib/services/userService';
import { claimIdempotency, completeIdempotency, hashIdempotencyPayload } from '@/lib/services/idempotencyService';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/services/userService', () => ({ deleteUserAccount: jest.fn() }));
jest.mock('@/lib/services/idempotencyService', () => ({
  claimIdempotency: jest.fn(),
  completeIdempotency: jest.fn(),
  hashIdempotencyPayload: jest.fn(() => 'hash-1'),
  getIdempotencyKey: (request: { headers: { get: (k: string) => string | null } }) => {
    const raw = request.headers.get('Idempotency-Key');
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 && trimmed.length <= 256 ? trimmed : null;
  },
}));

const sessionMock = getServerSession as unknown as jest.Mock;
const mockedDelete = deleteUserAccount as unknown as jest.Mock;
const mockedClaim = claimIdempotency as unknown as jest.Mock;
const mockedComplete = completeIdempotency as unknown as jest.Mock;

function request(body: unknown, headers: Record<string, string> = {}) {
  return {
    headers: { get: (name: string) => headers[name] ?? null },
    json: async () => body,
  } as unknown as NextRequest;
}

describe('DELETE /api/account', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    mockedClaim.mockResolvedValue({ kind: 'owner', rowId: 7 });
    mockedComplete.mockResolvedValue(undefined);
    mockedDelete.mockResolvedValue(3);
  });

  test('rejects unauthenticated deletion and never touches the account', async () => {
    sessionMock.mockResolvedValue(null);

    const res = await DELETE(request({ confirm: 'DELETE' }));

    expect(res.status).toBe(401);
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  test('requires the explicit confirm token so a stray DELETE cannot erase an account', async () => {
    const res = await DELETE(request({}));

    expect(res.status).toBe(400);
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  test('deletes the account and reports the itinerary count', async () => {
    const res = await DELETE(request({ confirm: 'DELETE' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, deletedItineraries: 3 });
    expect(mockedDelete).toHaveBeenCalledWith('user-1');
  });

  test('replays a completed deletion instead of deleting twice', async () => {
    mockedClaim.mockResolvedValue({
      kind: 'replay',
      replay: { status: 200, body: { success: true, deletedItineraries: 3 } },
    });

    const res = await DELETE(request({ confirm: 'DELETE' }, { 'Idempotency-Key': 'del-1' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, deletedItineraries: 3 });
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  test('answers 409 without deleting while a duplicate is in flight', async () => {
    mockedClaim.mockResolvedValue({ kind: 'conflict' });

    const res = await DELETE(request({ confirm: 'DELETE' }, { 'Idempotency-Key': 'del-1' }));

    expect(res.status).toBe(409);
    expect(res.headers.get('Retry-After')).toBe('1');
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  test('records the outcome against the claimed key', async () => {
    const res = await DELETE(request({ confirm: 'DELETE' }, { 'Idempotency-Key': 'del-1' }));
    const body = await res.json();

    expect(mockedClaim).toHaveBeenCalledWith('user-1', '/api/account', 'del-1', 'hash-1');
    expect(mockedComplete).toHaveBeenCalledWith(7, 200, body);
  });
});
