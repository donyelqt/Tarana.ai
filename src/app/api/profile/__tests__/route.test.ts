const MockedResponseProfile = globalThis.Response as unknown as { new(body?: unknown, init?: any): any; json(body: unknown, init?: any): any; };
if (typeof MockedResponseProfile.json !== 'function') {
  MockedResponseProfile.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponseProfile(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

import { NextRequest } from 'next/server';
import { GET, PATCH } from '../route';
import { getServerSession } from 'next-auth';
import { getProfileByEmail, updateProfileByEmail } from '@/lib/services/profileService';
import { claimIdempotency, completeIdempotency, hashIdempotencyPayload } from '@/lib/services/idempotencyService';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/services/profileService', () => ({
  getProfileByEmail: jest.fn(),
  updateProfileByEmail: jest.fn(),
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
const mockedGetServerSession = getServerSession as unknown as jest.Mock;
const mockedGetProfileByEmail = getProfileByEmail as unknown as jest.Mock;
const mockedUpdateProfileByEmail = updateProfileByEmail as unknown as jest.Mock;
const mockedClaimIdempotency = claimIdempotency as unknown as jest.Mock;
const mockedCompleteIdempotency = completeIdempotency as unknown as jest.Mock;
const mockedHashIdempotencyPayload = hashIdempotencyPayload as unknown as jest.Mock;

function authedRequest(body?: unknown): NextRequest {
  mockedGetServerSession.mockResolvedValue({
    user: { id: 'user-1', email: 'Test@Example.com' },
  });
  return {
    headers: { get: () => null },
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

const dbRow = {
  id: 'user-1',
  email: 'test@example.com',
  full_name: 'John Doe',
  image: 'img.png',
  location: 'Baguio',
  bio: 'hello',
};

describe('Profile API Route Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects unauthenticated requests with 401', async () => {
    mockedGetServerSession.mockResolvedValue(null);

    const req = {
      headers: { get: () => null },
    } as unknown as NextRequest;
    const response = await GET(req);
    expect(response.status).toBe(401);
    expect(mockedGetProfileByEmail).not.toHaveBeenCalled();
  });

  test('GET returns the mapped profile', async () => {
    mockedGetProfileByEmail.mockResolvedValue(dbRow);

    const response = await GET(authedRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.profile).toEqual({
      id: 'user-1',
      email: 'test@example.com',
      fullName: 'John Doe',
      image: 'img.png',
      location: 'Baguio',
      bio: 'hello',
    });
    expect(mockedGetProfileByEmail).toHaveBeenCalledWith('Test@Example.com');
  });

  test('GET returns 500 when the service throws', async () => {
    mockedGetProfileByEmail.mockRejectedValue(new Error('db down'));

    const response = await GET(authedRequest());
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe('Failed to fetch profile');
  });

  test('PATCH returns 400 when full name is missing', async () => {
    const response = await PATCH(authedRequest({ fullName: '   ' }));
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('Full name is required');
    expect(mockedUpdateProfileByEmail).not.toHaveBeenCalled();
  });

  test('PATCH truncates an over-long name to 100 characters via sanitizeName', async () => {
    mockedUpdateProfileByEmail.mockResolvedValue(dbRow);

    const response = await PATCH(authedRequest({ fullName: 'a'.repeat(150) }));
    expect(response.status).toBe(200);
    // sanitizeName caps at 100 chars, so the route-level >100 branch is
    // unreachable — the service receives the truncated name.
    expect(mockedUpdateProfileByEmail).toHaveBeenCalledWith(
      'Test@Example.com',
      { fullName: 'a'.repeat(100), location: undefined, bio: undefined }
    );
  });

  test('PATCH updates and returns the mapped profile', async () => {
    mockedUpdateProfileByEmail.mockResolvedValue({ ...dbRow, location: 'Manila' });

    const response = await PATCH(
      authedRequest({ fullName: 'John Doe', location: 'Manila', bio: 'hi' })
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.profile.location).toBe('Manila');
    expect(mockedUpdateProfileByEmail).toHaveBeenCalledWith(
      'Test@Example.com',
      { fullName: 'John Doe', location: 'Manila', bio: 'hi' }
    );
  });

  test('PATCH returns 500 when the service throws', async () => {
    mockedUpdateProfileByEmail.mockRejectedValue(new Error('db down'));

    const response = await PATCH(authedRequest({ fullName: 'John Doe' }));
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe('Failed to update profile');
  });
});

describe('profile PATCH idempotency (2.3-R4)', () => {
  function patchWithKey(body: unknown, key: string) {
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'user-1', email: 'Test@Example.com' },
    });
    return PATCH({
      headers: { get: (name: string) => (name === 'Idempotency-Key' ? key : null) },
      json: jest.fn().mockResolvedValue(body),
    } as unknown as NextRequest);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHashIdempotencyPayload.mockReturnValue('hash-1');
  });

  test('returns a cached replay instead of running the mutation', async () => {
    mockedClaimIdempotency.mockResolvedValue({
      kind: 'replay',
      replay: { status: 200, body: { success: true, profile: { id: 'user-1' } } },
    });

    const res = await patchWithKey({ fullName: 'John Doe' }, 'key-1');

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ profile: { id: 'user-1' } });
    expect(mockedUpdateProfileByEmail).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('claims, runs, and completes a first request with the exact response', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'owner', rowId: 7 });
    mockedUpdateProfileByEmail.mockResolvedValue(dbRow);
    mockedCompleteIdempotency.mockResolvedValue(undefined);

    const res = await patchWithKey({ fullName: 'John Doe' }, 'key-1');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockedClaimIdempotency).toHaveBeenCalledWith('Test@Example.com', '/api/profile', 'key-1', expect.any(String));
    expect(mockedUpdateProfileByEmail).toHaveBeenCalledTimes(1);
    expect(mockedCompleteIdempotency).toHaveBeenCalledWith(7, 200, body);
  });

  test('does not consult idempotency when no key is sent', async () => {
    mockedUpdateProfileByEmail.mockResolvedValue(dbRow);

    const res = await PATCH(authedRequest({ fullName: 'John Doe' }));

    expect(res.status).toBe(200);
    expect(mockedClaimIdempotency).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('rejects a concurrent duplicate without running the mutation', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'conflict' });

    const res = await patchWithKey({ fullName: 'John Doe' }, 'key-1');

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'Request is already being processed' });
    expect(res.headers.get('Retry-After')).toBe('1');
    expect(mockedUpdateProfileByEmail).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('rejects a reused key with a different payload without running the mutation', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'payload-mismatch' });

    const res = await patchWithKey({ fullName: 'Jane Doe' }, 'key-1');

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'Idempotency key was already used with a different payload' });
    expect(mockedUpdateProfileByEmail).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('caches a mutation failure so a replay cannot double-write', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'owner', rowId: 7 });
    mockedUpdateProfileByEmail.mockRejectedValue(new Error('db down'));
    mockedCompleteIdempotency.mockResolvedValue(undefined);

    const res = await patchWithKey({ fullName: 'John Doe' }, 'key-1');

    expect(res.status).toBe(500);
    expect(mockedCompleteIdempotency).toHaveBeenCalledWith(7, 500, { error: 'Failed to update profile' });
  });
});
