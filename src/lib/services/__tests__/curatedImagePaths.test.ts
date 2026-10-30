
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isRenderableImageUrl, RENDERABLE_IMAGE_HOSTS } from '../imageService';

const ROOT = process.cwd();
const PUBLIC_IMAGES = join(ROOT, 'public', 'images');

function curatedLocalPaths(): Array<{ title: string; file: string }> {
  const src = readFileSync(join(ROOT, 'src', 'lib', 'services', 'imageService.ts'), 'utf8');
  const block =
    src.split('const CURATED_IMAGE_MAP: Record<string, string> = {')[1]?.split('\n};')[0] ?? '';
  return [...block.matchAll(/"([^"]+)":\s*"([^"]+)"/g)]
    .map(([, title, path]) => ({ title, path, file: path.split('/').pop()! }))
    .filter(({ path }) => path.startsWith('/images/'))
    .map(({ title, file }) => ({ title, file }));
}

describe('curated Baguio image list integrity', () => {
  const onDisk = new Set(readdirSync(PUBLIC_IMAGES));
  const curated = curatedLocalPaths();

  it('covers the full curated list (guards the guards)', () => {
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
