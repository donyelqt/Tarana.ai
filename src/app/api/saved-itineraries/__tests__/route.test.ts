import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

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

import { GET, POST } from '../route';
import { getServerSession as mockedGetServerSession } from 'next-auth';
import { createItinerary, listItineraries } from '@/lib/services/itineraryService';
import { claimIdempotency, completeIdempotency, hashIdempotencyPayload } from '@/lib/services/idempotencyService';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/services/itineraryService', () => ({
  createItinerary: jest.fn(),
  listItineraries: jest.fn(),
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
const mockedListItineraries = listItineraries as unknown as jest.Mock;
const mockedCreateItinerary = createItinerary as unknown as jest.Mock;
const mockedClaimIdempotency = claimIdempotency as unknown as jest.Mock;
const mockedCompleteIdempotency = completeIdempotency as unknown as jest.Mock;
const mockedHashIdempotencyPayload = hashIdempotencyPayload as unknown as jest.Mock;
function makeRequest(): NextRequest {
  return { headers: { get: () => null } } as unknown as NextRequest;
}

const validBody = {
  title: 'Your 1 Day Itinerary',
  date: 'June 13, 2026 - June 14, 2026',
  budget: 'Budget',
  image: '/images/burnham.jpg',
  tags: ['Nature & Scenery'],
  formData: {
    budget: 'Budget',
    pax: 'Solo',
    duration: '1 Day',
    dates: { start: '2026-06-13T00:00:00.000Z', end: '2026-06-14T00:00:00.000Z' },
    selectedInterests: ['Nature & Scenery'],
  },
  itineraryData: {
    title: 'Baguio Day',
    subtitle: 'One day highlights',
    items: [
      {
        period: 'Morning',
        activities: [
          { title: 'Burnham Park', time: '9:00 AM', desc: 'Boats and gardens', tags: ['Nature'], image: '/images/burnham.jpg' },
        ],
      },
    ],
  },
};

function post(body: unknown) {
  return POST({ headers: { get: () => null }, json: async () => body } as unknown as NextRequest);
}

describe('saved-itineraries collection route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('GET returns 401 when unauthenticated', async () => {
    sessionMock.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Authentication required' });
    expect(mockedListItineraries).not.toHaveBeenCalled();
  });

  it('GET returns 200 with the caller-owned rows in newest-first order', async () => {
    mockedListItineraries.mockResolvedValue([]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, data: [], count: 0 });
    expect(mockedListItineraries).toHaveBeenCalledWith('user-1');
  });

  it('GET maps a service failure to 500', async () => {
    mockedListItineraries.mockRejectedValue(new Error('db down'));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Failed to fetch itineraries' });
  });

  it('POST returns 401 when unauthenticated', async () => {
    sessionMock.mockResolvedValue(null);
    const res = await post(validBody);
    expect(res.status).toBe(401);
    expect(mockedCreateItinerary).not.toHaveBeenCalled();
  });

  it('POST returns 400 on invalid input and never touches the database', async () => {
    const res = await post({ title: '' });
    expect(res.status).toBe(400);
    expect(mockedCreateItinerary).not.toHaveBeenCalled();
  });

  it('POST inserts scoped to the session user and returns 201', async () => {
    mockedCreateItinerary.mockResolvedValue({
      id: 'itin-1',
      title: validBody.title,
      form_data: validBody.formData,
      itinerary_data: validBody.itineraryData,
      created_at: '2026-09-15T00:00:00.000Z',
    });

    const res = await post(validBody);
    expect(res.status).toBe(201);
    expect(mockedCreateItinerary).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ title: validBody.title }),
      expect.any(String)
    );
    const body = (await res.json()) as { success: boolean; data: { id: string } };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('itin-1');
  });

  it('POST maps a database failure to 500', async () => {
    mockedCreateItinerary.mockRejectedValue(new Error('db down'));

    const res = await post(validBody);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Failed to save itinerary' });
  });

  it('rejects cross-user ownership tampering at the type level', async () => {
    // A caller sends another user's id inside formData: the route sources
    // user_id only from the session, never from the body (compile-time shape
    // has no user_id field, runtime insert uses session.user.id).
    mockedCreateItinerary.mockResolvedValue({ id: 'itin-1' });

    const res = await post({ ...validBody, user_id: 'user-2', userId: 'user-2' } as unknown as Record<
      string,
      unknown
    >);
    expect(res.status).toBe(201);
    expect(mockedCreateItinerary).toHaveBeenCalledWith('user-1', expect.anything(), expect.any(String));
    const input = mockedCreateItinerary.mock.calls[0][1] as Record<string, unknown>;
    expect(input).not.toHaveProperty('user_id');
    expect(input).not.toHaveProperty('userId');
  });

  it('accepts the exact generator save payload including traffic metadata', async () => {
    // Mirrors useItineraryGenerator.handleSaveItinerary: generated activities
    // carry trafficAnalysis/trafficLevel/lat/lon plus city scope passthrough.
    mockedCreateItinerary.mockResolvedValue({ id: 'itin-1' });

    const payload = {
      ...validBody,
      formData: { ...validBody.formData, trafficAware: true, cityId: 'baguio' },
      itineraryData: {
        ...validBody.itineraryData,
        items: [
          {
            period: 'Morning',
            activities: [
              {
                title: 'Burnham Park',
                time: '9:00 AM',
                desc: 'Boats and gardens',
                tags: ['Nature'],
                image: '/images/burnham.jpg',
                trafficAnalysis: { realTimeTraffic: { trafficLevel: 'LOW' }, lat: 16.4023, lon: 120.596 },
                trafficLevel: 'LOW',
                lat: 16.4023,
                lon: 120.596,
              },
            ],
          },
        ],
      },
    };
    const res = await post(payload);
    expect(res.status).toBe(201);
  });

  it('returns empty data array when the caller owns no rows', async () => {
    // Regression guard for "cannot access my itineraries": the old client
    // SELECT silently RLS-filtered to zero rows. The route must return an
    // explicit empty success (not 404) so list vs. forbidden stay distinct.
    mockedListItineraries.mockResolvedValue([]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, data: [], count: 0 });
  });

  it('maps stored JSON strings to objects for legacy rows', async () => {
    // Pre-migration rows may store form_data/itinerary_data as JSON text
    // (see savedItineraries.ts JSON.parse branches). The route must serve
    // the same object shape the detail page destructures.
    const legacyForm = JSON.stringify(validBody.formData);
    const legacyItinerary = JSON.stringify(validBody.itineraryData);
    mockedListItineraries.mockResolvedValue([
      {
        id: 'itin-legacy',
        title: validBody.title,
        date: validBody.date,
        budget: validBody.budget,
        image: validBody.image,
        tags: validBody.tags,
        form_data: legacyForm,
        itinerary_data: legacyItinerary,
        weather_data: null,
        created_at: '2026-09-15T00:00:00.000Z',
        refresh_metadata: null,
        traffic_snapshot: null,
        activity_coordinates: null,
      },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ formData: { budget: string }; itineraryData: { items: unknown[] } }>;
    };
    expect(body.data[0].formData.budget).toBe('Budget');
    expect(body.data[0].itineraryData.items).toHaveLength(1);
  });
});

describe('saved-itineraries POST idempotency (Phase 2.3)', () => {
  function postWithKey(body: unknown, key: string) {
    return {
      headers: { get: (name: string) => (name === 'Idempotency-Key' ? key : null) },
      json: async () => body,
    } as unknown as NextRequest;
  }

  function savedRow() {
    return {
      id: 'itin-1',
      title: validBody.title,
      form_data: validBody.formData,
      itinerary_data: validBody.itineraryData,
      created_at: '2026-09-15T00:00:00.000Z',
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    mockedHashIdempotencyPayload.mockReturnValue('hash-1');
  });

  it('returns a cached replay instead of running the mutation', async () => {
    mockedClaimIdempotency.mockResolvedValue({
      kind: 'replay',
      replay: { status: 201, body: { success: true, data: { id: 'itin-cached' } } },
    });

    const res = await POST(postWithKey(validBody, 'key-1'));

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ data: { id: 'itin-cached' } });
    expect(mockedCreateItinerary).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  it('claims, runs, and completes a first request with the exact response', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'owner', rowId: 7 });
    mockedCreateItinerary.mockResolvedValue(savedRow());
    mockedCompleteIdempotency.mockResolvedValue(undefined);

    const res = await POST(postWithKey(validBody, 'key-1'));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(mockedClaimIdempotency).toHaveBeenCalledWith('user-1', '/api/saved-itineraries', 'key-1', expect.any(String));
    expect(mockedCreateItinerary).toHaveBeenCalledTimes(1);
    expect(mockedCompleteIdempotency).toHaveBeenCalledWith(7, 201, body);
  });

  it('does not consult idempotency when no key is sent', async () => {
    mockedCreateItinerary.mockResolvedValue(savedRow());

    const res = await post(validBody);

    expect(res.status).toBe(201);
    expect(mockedClaimIdempotency).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  it('returns the cached status, not a blanket 200, on replay', async () => {
    mockedClaimIdempotency.mockResolvedValue({
      kind: 'replay',
      replay: { status: 500, body: { error: 'Failed to save itinerary' } },
    });

    const res = await POST(postWithKey(validBody, 'key-1'));

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Failed to save itinerary' });
    expect(mockedCreateItinerary).not.toHaveBeenCalled();
  });

  it('rejects a concurrent duplicate without running the mutation', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'conflict' });

    const res = await POST(postWithKey(validBody, 'key-1'));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'Request is already being processed' });
    expect(res.headers.get('Retry-After')).toBe('1');
    expect(mockedCreateItinerary).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  it('rejects a reused key with a different payload without running the mutation', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'payload-mismatch' });

    const res = await POST(postWithKey({ ...validBody, title: 'Different trip' }, 'key-1'));

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'Idempotency key was already used with a different payload' });
    expect(mockedCreateItinerary).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  it('caches a mutation failure so a replay cannot double-write', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'owner', rowId: 7 });
    mockedCreateItinerary.mockRejectedValue(new Error('db down'));
    mockedCompleteIdempotency.mockResolvedValue(undefined);

    const res = await POST(postWithKey(validBody, 'key-1'));

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Failed to save itinerary' });
    expect(mockedCompleteIdempotency).toHaveBeenCalledWith(7, 500, { error: 'Failed to save itinerary' });
  });
});
