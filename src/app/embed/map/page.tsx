import EmbedMap from './EmbedMap';

/**
 * Standalone TomTom map for the mobile app WebView (no sidebar, no auth).
 * Public route (not in PROTECTED_ROUTES): it renders only first-party map
 * tiles + route shapes pushed over the native bridge — no user data, no
 * session. The TomTom key stays server-side-approved: requests originate
 * from this web origin, satisfying the key's referrer allowlist the same
 * way the main explore page does.
 */
export default function EmbedMapPage() {
  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-gray-100">
      <EmbedMap />
    </div>
  );
}
