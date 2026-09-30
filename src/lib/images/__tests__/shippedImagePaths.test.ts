/**
 * Drift guard: every `/images/...` path a production file can hand to
 * `next/image` must exist on disk.
 *
 * The bug class this catches is silent. `getFallbackImage()` branched across
 * six themed placeholders; none of the six existed in `public/`, so each
 * branch 404'd, `next/image` fired `onError`, and the card degraded to the
 * logo — reached through a path that never loaded. Same for
 * `/images/default.jpg`, `/images/placeholder.png` and
 * `/assets/images/placeholder.png`. Every one looks correct in review and
 * produces no log line; the only symptom is the wrong picture.
 *
 * Excluded, deliberately:
 * - test files — their literals are fixtures, not shipped paths
 * - `enhancedPromptEngine.ts` — its `/images/...` strings are few-shot
 *   examples inside prompt text, never rendered
 * - remote `http(s)` URLs — served by a provider, not `public/`
 *
 * Compared against the real directory listing, never `existsSync`: a
 * case-insensitive filesystem must not be able to pass a broken path.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = process.cwd();
const EXCLUDED_FILES = [
  'src/app/api/gemini/itinerary-generator/lib/enhancedPromptEngine.ts',
];

function publicIndex(): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      // Keep the leading slash: production literals are site-absolute
      // ("/images/x.png"), and posix.join('', 'images') drops it.
      const url = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walk(abs, url);
      else out.add(url);
    }
  };
  walk(join(ROOT, 'public'), '');
  return out;
}


function productionFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(abs);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        const rel = abs.slice(ROOT.length + 1).split(/[\\/]/).join('/');
        if (!EXCLUDED_FILES.includes(rel)) files.push(abs);
      }
    }
  };
  walk(join(ROOT, 'src'));
  return files;
}

describe('every shipped image path exists on disk', () => {
  const index = publicIndex();

  const referenced = productionFiles().flatMap((file) => {
    const src = readFileSync(file, 'utf8');
    return [...src.matchAll(/['"`](\/images\/[^'"`]+)['"`]/g)].map((m) => ({
      file: file.slice(ROOT.length + 1).split(/[\\/]/).join('/'),
      path: m[1],
    }));
  });

  it('finds the production image literals (guards the guard)', () => {
    expect(referenced.length).toBeGreaterThan(5);
  });

  it('has no path that 404s', () => {
    const phantom = referenced.filter(({ path }) => !index.has(path));
    expect(phantom).toEqual([]);
  });

  it('has no path that differs from disk only by letter case', () => {
    const lower = new Map([...index].map((p) => [p.toLowerCase(), p]));
    const wrongCase = referenced.filter(
      ({ path }) => !index.has(path) && lower.has(path.toLowerCase())
    );
    expect(wrongCase).toEqual([]);
  });

  it('points at non-empty files', () => {
    const empty = referenced
      .filter(({ path }) => index.has(path))
      .filter(({ path }) => statSync(join(ROOT, 'public', path)).size === 0)
      .map(({ path }) => path);
    expect(empty).toEqual([]);
  });

  it('keeps the documented fallback resolving', () => {
    // The card base layer and the server re-attach both assume this asset.
    expect(index.has('/images/taranaai.png')).toBe(true);
  });
});
