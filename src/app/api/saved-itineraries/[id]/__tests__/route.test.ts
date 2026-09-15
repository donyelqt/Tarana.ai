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
import { supabaseAdmin as mockedSupabaseAdmin } from '@/lib/data/supabaseAdmin';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/data/supabaseAdmin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

const sessionMock = mockedGetServerSession as unknown as jest.Mock;
const fromMock = (mockedSupabaseAdmin.from as unknown as jest.Mock);

const params = (id = 'itin-1') => ({ params: Promise.resolve({ id }) });
const req = (body?: unknown) =>
  ({ json: async () => body }) as unknown as NextRequest;

const row = {
  id: 'itin-1',
  title: 'Your 1 Day Itinerary',
  form_data: { budget: 'Budget' },
  itinerary_data: { title: 'Day', items: [] },
  created_at: '2026-09-15T00:00:00.000Z',
};

function chainResult(result: unknown) {
  // Builds .eq().eq().{single|select().single()} chains used by the route.
  const single = jest.fn().mockResolvedValue(result);
  const select = jest.fn().mockReturnValue({ single });
  const eq2 = jest.fn().mockReturnValue({ single, select });
  const eq1 = jest.fn().mockReturnValue({ eq: eq2, single, select });
  fromMock.mockReturnValue({ select: jest.fn().mockReturnValue({ eq: eq1 }), update: jest.fn().mockReturnValue({ eq: eq1 }), delete: jest.fn().mockReturnValue({ eq: eq1 }) });
  return { eq1, eq2 };
}

describe('saved-itineraries [id] route', () => {
  beforeEach(() => {
    sessionMock.mockReset();
    fromMock.mockReset();
  });

  it('returns 401 on every method when unauthenticated', async () => {
    sessionMock.mockResolvedValue(null);
    expect((await GET(req(), params())).status).toBe(401);
    expect((await PATCH(req({ title: 'x' }), params())).status).toBe(401);
    expect((await DELETE(req(), params())).status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('GET returns 404 when the row belongs to another user', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    chainResult({ data: null, error: { message: 'no rows' } });
    const res = await GET(req(), params());
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Itinerary not found' });
  });

  it('GET scopes the lookup to id + session user', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const { eq1, eq2 } = chainResult({ data: row, error: null });
    const res = await GET(req(), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    expect(eq1).toHaveBeenCalledWith('id', 'itin-1');
    expect(eq2).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('PATCH returns 400 on invalid input and empty payload without touching the database', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    expect((await PATCH(req({ title: '' }), params())).status).toBe(400);
    expect((await PATCH(req({}), params())).status).toBe(400);
    expect((await PATCH(req({ user_id: 'user-2' }), params())).status).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('PATCH maps refresh fields to snake_case and scopes to the owner', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const updateEq = jest.fn();
    const updateEq2 = jest.fn();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const select = jest.fn().mockReturnValue({ single });
    updateEq2.mockReturnValue({ select });
    updateEq.mockReturnValue({ eq: updateEq2 });
    const update = jest.fn().mockReturnValue({ eq: updateEq });
    fromMock.mockReturnValue({ update });

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
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        refresh_metadata: refreshMetadata,
        traffic_snapshot: { incidentCount: 0 },
        activity_coordinates: [],
      })
    );
    expect(updateEq).toHaveBeenCalledWith('id', 'itin-1');
    expect(updateEq2).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('PATCH allows explicit null to clear refresh state', async () => {
    // Mirrors updateItinerary's explicit-undefined contract: null must reach
    // the database (clears refresh_metadata), unlike a dropped key.
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const updateEq2 = jest.fn().mockReturnValue({ select });
    const updateEq = jest.fn().mockReturnValue({ eq: updateEq2 });
    const update = jest.fn().mockReturnValue({ eq: updateEq });
    fromMock.mockReturnValue({ update });

    const res = await PATCH(req({ refreshMetadata: null }), params());
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ refresh_metadata: null }));
  });

  it('PATCH returns 404 when the row is missing or not owned', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const single = jest.fn().mockResolvedValue({ data: null, error: { message: 'no rows' } });
    const select = jest.fn().mockReturnValue({ single });
    const updateEq2 = jest.fn().mockReturnValue({ select });
    const updateEq = jest.fn().mockReturnValue({ eq: updateEq2 });
    fromMock.mockReturnValue({ update: jest.fn().mockReturnValue({ eq: updateEq }) });

    const res = await PATCH(req({ title: 'New' }), params());
    expect(res.status).toBe(404);
  });

  it('DELETE scopes to id + owner and returns 404 when absent', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const single = jest.fn().mockResolvedValue({ data: null, error: { message: 'no rows' } });
    const select = jest.fn().mockReturnValue({ single });
    const deleteEq2 = jest.fn().mockReturnValue({ select });
    const deleteEq = jest.fn().mockReturnValue({ eq: deleteEq2 });
    fromMock.mockReturnValue({ delete: jest.fn().mockReturnValue({ eq: deleteEq }) });

    const res = await DELETE(req(), params());
    expect(res.status).toBe(404);
    expect(deleteEq).toHaveBeenCalledWith('id', 'itin-1');
    expect(deleteEq2).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('DELETE returns success for an owned row', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const single = jest.fn().mockResolvedValue({ data: { id: 'itin-1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const deleteEq2 = jest.fn().mockReturnValue({ select });
    const deleteEq = jest.fn().mockReturnValue({ eq: deleteEq2 });
    fromMock.mockReturnValue({ delete: jest.fn().mockReturnValue({ eq: deleteEq }) });

    const res = await DELETE(req(), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
  });
});
