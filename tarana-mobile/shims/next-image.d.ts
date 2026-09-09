/**
 * Platform shim: on mobile there is no `next/image`.
 *
 * The web app uses `StaticImageData` as a richer image type, but the shared
 * lib only ever inspects `.src` (see
 * `src/lib/data/savedItineraries.ts:143`) and the runtime already normalizes
 * everything to a string. So on mobile the type collapses to string —
 * behavior is identical, and the web build is untouched.
 *
 * Only the mobile tsconfig resolves this module; the root tsconfig keeps
 * pulling the real `next/image`.
 */
declare module 'next/image' {
  export type StaticImageData = { src: string };
}