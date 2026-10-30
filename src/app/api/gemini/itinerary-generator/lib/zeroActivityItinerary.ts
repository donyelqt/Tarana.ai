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
