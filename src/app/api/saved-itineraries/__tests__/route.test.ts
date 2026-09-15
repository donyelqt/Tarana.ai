import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import { z } from 'zod';

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
import { supabaseAdmin as mockedSupabaseAdmin } from '@/lib/data/supabaseAdmin';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/data/supabaseAdmin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

const sessionMock = mockedGetServerSession as unknown as jest.Mock;
const fromMock = (mockedSupabaseAdmin.from as unknown as jest.Mock);

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
  return POST({ json: async () => body } as unknown as NextRequest);
}

describe('saved-itineraries collection route', () => {
  beforeEach(() => {
    sessionMock.mockReset();
    fromMock.mockReset();
  });

  it('GET returns 401 when unauthenticated', async () => {
    sessionMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('GET returns 200 with the caller-owned rows in newest-first order', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const order = jest.fn().mockResolvedValue({ data: [], error: null });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, data: [], count: 0 });
    expect(fromMock).toHaveBeenCalledWith('itineraries');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('POST returns 401 when unauthenticated', async () => {
    sessionMock.mockResolvedValue(null);
    const res = await post(validBody);
    expect(res.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('POST returns 400 on invalid input and never touches the database', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const res = await post({ title: '' });
    expect(res.status).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('POST inserts with admin client scoped to the session user and returns 201', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const single = jest.fn().mockResolvedValue({
      data: {
        id: 'itin-1',
        title: validBody.title,
        form_data: validBody.formData,
        itinerary_data: validBody.itineraryData,
        created_at: '2026-09-15T00:00:00.000Z',
      },
      error: null,
    });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    fromMock.mockReturnValue({ insert });

    const res = await post(validBody);
    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', title: validBody.title })
    );
    expect(fromMock).toHaveBeenCalledWith('itineraries');
    const body = (await res.json()) as { success: boolean; data: { id: string } };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('itin-1');
  });

  it('POST maps a database failure to 500', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const single = jest.fn().mockResolvedValue({ data: null, error: { message: 'db down' } });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    fromMock.mockReturnValue({ insert });

    const res = await post(validBody);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Failed to save itinerary' });
  });

  it('rejects cross-user ownership tampering at the type level', async () => {
    // A caller sends another user's id inside formData: the route sources
    // user_id only from the session, never from the body (compile-time shape
    // has no user_id field, runtime insert uses session.user.id).
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const single = jest.fn().mockResolvedValue({ data: { id: 'itin-1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    fromMock.mockReturnValue({ insert });

    const res = await post({ ...validBody, user_id: 'user-2', userId: 'user-2' } as unknown as Record<
      string,
      unknown
    >);
    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1' }));
    expect(insert).not.toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-2' }));
  });

  it('accepts the exact generator save payload including traffic metadata', async () => {
    // Mirrors useItineraryGenerator.handleSaveItinerary: generated activities
    // carry trafficAnalysis/trafficLevel/lat/lon plus city scope passthrough.
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const single = jest.fn().mockResolvedValue({ data: { id: 'itin-1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    fromMock.mockReturnValue({ insert });

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
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const order = jest.fn().mockResolvedValue({ data: [], error: null });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, data: [], count: 0 });
  });

  it('maps stored JSON strings to objects for legacy rows', async () => {
    // Pre-migration rows may store form_data/itinerary_data as JSON text
    // (see savedItineraries.ts JSON.parse branches). The route must serve
    // the same object shape the detail page destructures.
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const legacyForm = JSON.stringify(validBody.formData);
    const legacyItinerary = JSON.stringify(validBody.itineraryData);
    const order = jest.fn().mockResolvedValue({
      data: [
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
      ],
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ formData: { budget: string }; itineraryData: { items: unknown[] } }>;
    };
    expect(body.data[0].formData.budget).toBe('Budget');
    expect(body.data[0].itineraryData.items).toHaveLength(1);
  });
});
