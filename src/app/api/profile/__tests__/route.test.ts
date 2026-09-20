const MockedResponseProfile = globalThis.Response as unknown as { new(body?: unknown, init?: any): any; json(body: unknown, init?: any): any; };
if (typeof MockedResponseProfile.json !== 'function') {
  MockedResponseProfile.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponseProfile(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

import { NextRequest } from 'next/server';
import { GET, PATCH } from '../route';
import { getServerSession } from 'next-auth';
import { getProfileByEmail, updateProfileByEmail } from '@/lib/services/profileService';

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

const mockedGetServerSession = getServerSession as unknown as jest.Mock;
const mockedGetProfileByEmail = getProfileByEmail as unknown as jest.Mock;
const mockedUpdateProfileByEmail = updateProfileByEmail as unknown as jest.Mock;

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
