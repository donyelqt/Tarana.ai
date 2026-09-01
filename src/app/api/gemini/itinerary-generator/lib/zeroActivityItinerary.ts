/**
 * H1 hotfix (2026-09-01): detect zero-activity itineraries so we can refund the
 * credit on a happy-path zero result. The catch block at the bottom of POST()
 * only refunds on thrown errors; this helper covers the case where generation
 * succeeded but returned no usable activities (empty items, every item has
 * zero activities, or response is unparseable).
 *
 * Kept in a standalone module (not embedded in route.ts) so the unit test
 * can import it without pulling in next/server, next/cache, next-auth, and the
 * Supabase client — which would fail in the Jest test environment.
 */
export function isZeroActivityItinerary(text: string | undefined | null): boolean {
    if (!text) return true;
    try {
        const parsed = JSON.parse(text);
        const items = Array.isArray(parsed?.items) ? parsed.items : [];
        if (items.length === 0) return true;
        return items.every(
            (it: any) => !Array.isArray(it?.activities) || it.activities.length === 0
        );
    } catch {
        return true;
    }
}
