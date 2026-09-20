const MockedResponseInitProfile = globalThis.Response as unknown as { new(body?: unknown, init?: any): any; json(body: unknown, init?: any): any; };
if (typeof MockedResponseInitProfile.json !== 'function') {
  MockedResponseInitProfile.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponseInitProfile(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getServerSession } from 'next-auth';
import { createUserProfile, userProfileExists } from '@/lib/services/userService';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/services/userService', () => ({
  createUserProfile: jest.fn(),
  userProfileExists: jest.fn(),
}));

const mockedGetServerSession = getServerSession as unknown as jest.Mock;
const mockedCreateUserProfile = createUserProfile as unknown as jest.Mock;
const mockedUserProfileExists = userProfileExists as unknown as jest.Mock;

function authedRequest(): NextRequest {
  return { headers: { get: () => null } } as unknown as NextRequest;
}

describe('Init Profile API Route Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
  });

  test('rejects unauthenticated requests with 401', async () => {
    mockedGetServerSession.mockResolvedValue(null);

    const response = await POST(authedRequest());
    expect(response.status).toBe(401);
    expect(mockedUserProfileExists).not.toHaveBeenCalled();
  });

  test('returns action none when the profile already exists', async () => {
    mockedUserProfileExists.mockResolvedValue(true);

    const response = await POST(authedRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({ success: true, action: 'none' });
    expect(mockedCreateUserProfile).not.toHaveBeenCalled();
  });

  test('creates the default profile when missing', async () => {
    mockedUserProfileExists.mockResolvedValue(false);
    mockedCreateUserProfile.mockResolvedValue(undefined);

    const response = await POST(authedRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({ success: true, action: 'created' });
    expect(mockedCreateUserProfile).toHaveBeenCalledWith('user-1');
  });

  test('returns 500 when creation fails', async () => {
    mockedUserProfileExists.mockResolvedValue(false);
    mockedCreateUserProfile.mockRejectedValue(new Error('db down'));

    const response = await POST(authedRequest());
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe('Failed to create profile');
  });
});
