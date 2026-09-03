/**
 * Tests for GET /api/stats (dashboard Tarana Stats widget).
 * Public aggregates: exact-count head queries + static cafes length.
 */
import { GET } from '../route';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import { restaurants } from '@/app/tarana-eats/data/taranaEatsData';

jest.mock('@/lib/data/supabaseAdmin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

// jest.setup.js replaces global Response with a minimal mock lacking the
// static json() NextResponse.json() delegates to. Restore just that static.
const MockedResponse = globalThis.Response as unknown as {
  new (body?: unknown, init?: { status?: number; headers?: Record<string, string> }): InstanceType<typeof globalThis.Response>;
  json(body: unknown, init?: { status?: number }): unknown;
};
if (typeof MockedResponse.json !== 'function') {
  MockedResponse.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponse(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
}

const fromMock = supabaseAdmin.from as unknown as jest.Mock;
const COUNTS: Record<string, number> = { itineraries: 12, saved_meals: 34, users: 56 };

function mockCounts(counts: Record<string, number> = COUNTS, failingTable?: string) {
  fromMock.mockImplementation((table: string) => ({
    select: async () =>
      table === failingTable
        ? { count: null, error: { message: 'db down' } }
        : { count: counts[table] ?? 0, error: null },
  }));
}

describe('GET /api/stats', () => {
  beforeEach(() => mockCounts());

  it('returns exact counts plus the static cafes length', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      stats: { itineraries: 12, cafes: restaurants.length, meals: 34, explorers: 56 },
    });
    expect(restaurants.length).toBeGreaterThan(0);
  });

  it('returns 500 when any count query fails', async () => {
    mockCounts(COUNTS, 'saved_meals');
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
