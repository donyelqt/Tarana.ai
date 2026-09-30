/**
 * Drift guard for the whole curated Baguio image list.
 *
 * Two classes of silent "card shows the logo instead of the photo" bug, both
 * invisible on a case-insensitive dev filesystem and fatal on Vercel/Linux:
 *
 * 1. CASE DRIFT — `K-Flavors Buffet` shipped as `kflavors_taranagala.JPG`
 *    while the file is `kflavors_taranagala.jpg` (and `Korean Palace Kung
 *    Jeon` had the mirror-image mismatch). macOS/Windows resolve it via
 *    `existsSync`; Linux 404s, `next/image` fires `onError`, logo.
 * 2. BROKEN ASSET — a curated path pointing at a zero-byte or missing file
 *    degrades the same way.
 *
 * So every check compares against the real directory listing and stat, never
 * `existsSync` — a case-insensitive FS would pass a broken path here.
 * Same intent as `imageHosts.test.ts` (service hosts vs next.config).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isRenderableImageUrl, RENDERABLE_IMAGE_HOSTS } from '../imageService';

const ROOT = process.cwd();
const PUBLIC_IMAGES = join(ROOT, 'public', 'images');

/** Local curated entries only — remote overrides (e.g. the MCU Wikimedia
 *  file) are fetched over HTTPS and are covered by mcuImageOverride.test.ts. */
function curatedLocalPaths(): Array<{ title: string; file: string }> {
  const src = readFileSync(join(ROOT, 'src', 'lib', 'services', 'imageService.ts'), 'utf8');
  const block =
    src.split('const CURATED_IMAGE_MAP: Record<string, string> = {')[1]?.split('\n};')[0] ?? '';
  return [...block.matchAll(/"([^"]+)":\s*"([^"]+)"/g)]
    .map(([, title, path]) => ({ title, path, file: path.split('/').pop()! }))
    // Filter on the full path, not the file name: a remote override's last
    // segment looks like a local file but is served over HTTPS.
    .filter(({ path }) => path.startsWith('/images/'))
    .map(({ title, file }) => ({ title, file }));
}

describe('curated Baguio image list integrity', () => {
  const onDisk = new Set(readdirSync(PUBLIC_IMAGES));
  const curated = curatedLocalPaths();

  it('covers the full curated list (guards the guards)', () => {
    // If this ever shrinks, the checks below are silently checking less.
    expect(curated.length).toBeGreaterThanOrEqual(30);
  });

  it('every local curated path matches a real file name byte-for-byte', () => {
    const broken = curated.filter(({ file }) => !onDisk.has(file));
    expect(broken).toEqual([]);
  });

  it('no curated path differs from disk only by letter case', () => {
    const lowerIndex = new Map([...onDisk].map((f) => [f.toLowerCase(), f]));
    const wrongCase = curated.filter(
      ({ file }) => !onDisk.has(file) && lowerIndex.has(file.toLowerCase())
    );
    expect(wrongCase).toEqual([]);
  });

  it('every curated asset is a non-empty readable file', () => {
    const empty: string[] = [];
    for (const { file } of curated) {
      if (!onDisk.has(file)) continue;
      if (statSync(join(PUBLIC_IMAGES, file)).size === 0) empty.push(file);
    }
    expect(empty).toEqual([]);
  });

  it('every curated path is a local /images/ path next/image can serve', () => {
    const src = readFileSync(join(ROOT, 'src', 'lib', 'services', 'imageService.ts'), 'utf8');
    const block =
      src.split('const CURATED_IMAGE_MAP: Record<string, string> = {')[1]?.split('\n};')[0] ?? '';
    const bad = [...block.matchAll(/"([^"]+)":\s*"([^"]+)"/g)]
      .map(([, , path]) => path)
      .filter((p) => !p.startsWith('/images/') && !p.startsWith('http'));
    expect(bad).toEqual([]);
  });

  it('still resolves every curated host through the renderer allowlist', () => {
    for (const host of RENDERABLE_IMAGE_HOSTS) {
      expect(isRenderableImageUrl(`https://${host}/photo.jpg`)).toBe(true);
    }
  });
});
