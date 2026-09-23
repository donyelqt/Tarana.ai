import { NextRequest } from 'next/server';

const MockedResponse = globalThis.Response as unknown as {
  new (body?: unknown, init?: { status?: number; headers?: Record<string, string> }): InstanceType<
    typeof globalThis.Response
  >;
  json(body: unknown, init?: { status?: number }): unknown;
};
if (typeof MockedResponse.json !== 'function') {
  MockedResponse.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponse(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
}

import { GET, PATCH, DELETE } from '../route';
import { getServerSession as mockedGetServerSession } from 'next-auth';
import {
  deleteItineraryById,
  getItineraryById,
  updateItineraryById,
} from '@/lib/services/itineraryService';
import { claimIdempotency, completeIdempotency, hashIdempotencyPayload } from '@/lib/services/idempotencyService';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/services/itineraryService', () => ({
  deleteItineraryById: jest.fn(),
  getItineraryById: jest.fn(),
  updateItineraryById: jest.fn(),
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
const sessionMock = mockedGetServerSession as unknown as jest.Mock;
const mockedGetItineraryById = getItineraryById as unknown as jest.Mock;
const mockedUpdateItineraryById = updateItineraryById as unknown as jest.Mock;
const mockedDeleteItineraryById = deleteItineraryById as unknown as jest.Mock;
const mockedClaimIdempotency = claimIdempotency as unknown as jest.Mock;
const mockedCompleteIdempotency = completeIdempotency as unknown as jest.Mock;
const mockedHashIdempotencyPayload = hashIdempotencyPayload as unknown as jest.Mock;

const params = (id = 'itin-1') => ({ params: Promise.resolve({ id }) });
const req = (body?: unknown) =>
  ({ headers: { get: () => null }, json: async () => body }) as unknown as NextRequest;

const row = {
  id: 'itin-1',
  title: 'Your 1 Day Itinerary',
  form_data: { budget: 'Budget' },
  itinerary_data: { title: 'Day', items: [] },
  created_at: '2026-09-15T00:00:00.000Z',
};

describe('saved-itineraries [id] route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('returns 401 on every method when unauthenticated', async () => {
    sessionMock.mockResolvedValue(null);
    expect((await GET(req(), params())).status).toBe(401);
    expect((await PATCH(req({ title: 'x' }), params())).status).toBe(401);
    expect((await DELETE(req(), params())).status).toBe(401);
    expect(mockedGetItineraryById).not.toHaveBeenCalled();
    expect(mockedUpdateItineraryById).not.toHaveBeenCalled();
    expect(mockedDeleteItineraryById).not.toHaveBeenCalled();
  });

  it('GET returns 404 when the row belongs to another user', async () => {
    mockedGetItineraryById.mockResolvedValue(null);
    const res = await GET(req(), params());
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Itinerary not found' });
  });

  it('GET scopes the lookup to id + session user', async () => {
    mockedGetItineraryById.mockResolvedValue(row);
    const res = await GET(req(), params());
    expect(res.status).toBe(200);
    expect(mockedGetItineraryById).toHaveBeenCalledWith('itin-1', 'user-1');
    expect(await res.json()).toMatchObject({ success: true });
  });

  it('PATCH returns 400 on invalid input and empty payload without touching the database', async () => {
    expect((await PATCH(req({ title: '' }), params())).status).toBe(400);
    expect((await PATCH(req({}), params())).status).toBe(400);
    expect((await PATCH(req({ user_id: 'user-2' }), params())).status).toBe(400);
    expect(mockedUpdateItineraryById).not.toHaveBeenCalled();
  });

  it('PATCH maps refresh fields to snake_case and scopes to the owner', async () => {
    mockedUpdateItineraryById.mockResolvedValue(row);

    const refreshMetadata = {
      lastEvaluatedAt: new Date().toISOString(),
      refreshCount: 1,
      status: 'REFRESH_COMPLETED',
    };
    const res = await PATCH(
      req({ refreshMetadata, trafficSnapshot: { incidentCount: 0 }, activityCoordinates: [] }),
      params()
    );
    expect(res.status).toBe(200);
    expect(mockedUpdateItineraryById).toHaveBeenCalledWith(
      'itin-1',
      'user-1',
      expect.objectContaining({
        refresh_metadata: refreshMetadata,
        traffic_snapshot: { incidentCount: 0 },
        activity_coordinates: [],
      })
    );
  });

  it('PATCH allows explicit null to clear refresh state', async () => {
    // Mirrors updateItinerary's explicit-undefined contract: null must reach
    // the database (clears refresh_metadata), unlike a dropped key.
    mockedUpdateItineraryById.mockResolvedValue(row);

    const res = await PATCH(req({ refreshMetadata: null }), params());
    expect(res.status).toBe(200);
    expect(mockedUpdateItineraryById).toHaveBeenCalledWith(
      'itin-1',
      'user-1',
      expect.objectContaining({ refresh_metadata: null })
    );
  });

  it('PATCH returns 404 when the row is missing or not owned', async () => {
    mockedUpdateItineraryById.mockResolvedValue(null);

    const res = await PATCH(req({ title: 'New' }), params());
    expect(res.status).toBe(404);
  });

  it('DELETE scopes to id + owner and returns 404 when absent', async () => {
    mockedDeleteItineraryById.mockResolvedValue(false);

    const res = await DELETE(req(), params());
    expect(res.status).toBe(404);
    expect(mockedDeleteItineraryById).toHaveBeenCalledWith('itin-1', 'user-1');
  });

  it('DELETE returns success for an owned row', async () => {
    mockedDeleteItineraryById.mockResolvedValue(true);

    const res = await DELETE(req(), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
  });
});

describe('saved-itineraries [id] PATCH idempotency (2.3-R3)', () => {
  function patchWithKey(body: unknown, key: string, id = 'itin-1') {
    return PATCH(
      {
        headers: { get: (name: string) => (name === 'Idempotency-Key' ? key : null) },
        json: async () => body,
      } as unknown as NextRequest,
      params(id)
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    mockedHashIdempotencyPayload.mockReturnValue('hash-1');
  });

  test('returns a cached replay instead of running the mutation', async () => {
    mockedClaimIdempotency.mockResolvedValue({
      kind: 'replay',
      replay: { status: 200, body: { success: true, data: { id: 'itin-cached' } } },
    });

    const res = await patchWithKey({ title: 'New' }, 'key-1');

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ data: { id: 'itin-cached' } });
    expect(mockedUpdateItineraryById).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('claims, runs, and completes a first request with the exact response', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'owner', rowId: 7 });
    mockedUpdateItineraryById.mockResolvedValue(row);
    mockedCompleteIdempotency.mockResolvedValue(undefined);

    const res = await patchWithKey({ title: 'New' }, 'key-1');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockedClaimIdempotency).toHaveBeenCalledWith('user-1', '/api/saved-itineraries/itin-1', 'key-1', expect.any(String));
    expect(mockedUpdateItineraryById).toHaveBeenCalledTimes(1);
    expect(mockedCompleteIdempotency).toHaveBeenCalledWith(7, 200, body);
  });

  test('does not consult idempotency when no key is sent', async () => {
    mockedUpdateItineraryById.mockResolvedValue(row);

    const res = await PATCH(req({ title: 'New' }), params());

    expect(res.status).toBe(200);
    expect(mockedClaimIdempotency).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('rejects a concurrent duplicate without running the mutation', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'conflict' });

    const res = await patchWithKey({ title: 'New' }, 'key-1');

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'Request is already being processed' });
    expect(res.headers.get('Retry-After')).toBe('1');
    expect(mockedUpdateItineraryById).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('rejects a reused key with a different payload without running the mutation', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'payload-mismatch' });

    const res = await patchWithKey({ title: 'Different' }, 'key-1');

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'Idempotency key was already used with a different payload' });
    expect(mockedUpdateItineraryById).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('caches a 404 miss so a replay cannot re-run the lookup', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'owner', rowId: 7 });
    mockedUpdateItineraryById.mockResolvedValue(null);
    mockedCompleteIdempotency.mockResolvedValue(undefined);

    const res = await patchWithKey({ title: 'New' }, 'key-1');

    expect(res.status).toBe(404);
    expect(mockedCompleteIdempotency).toHaveBeenCalledWith(7, 404, { error: 'Itinerary not found' });
  });
});
