/**
 * Regression: Baguio Gala cards rendered the logo fallback even though
 * `CURATED_IMAGE_MAP` holds a verified photo for every curated place
 * (e.g. "K-Flavors Buffet" → /images/kflavors_taranagala.JPG).
 *
 * Root cause: `enrichActivitiesWithImages` had two exits that skipped Tier 0
 * entirely — the "all curated" fast path returned the input array untouched,
 * and the per-item loop `return`ed on a curated title before ever calling
 * `getAccurateImageForPlace`. So the curated image was only reachable via a
 * path curated titles never take. Baguio activities arrive from vector
 * search / the TomTom supplement with `image: ""`, so they kept the empty
 * string all the way to the client fallback.
 */

describe('curated Baguio images survive batch enrichment', () => {
  let fetchMock: jest.Mock;
  let enrichActivitiesWithImages: typeof import('../imageService').enrichActivitiesWithImages;

  beforeEach(async () => {
    jest.resetModules();
    fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    ({ enrichActivitiesWithImages } = await import('../imageService'));
  });

  it('applies the curated photo when every activity is curated (fast path)', async () => {
    // Baguio vector search hands these over with an empty image string.
    const out = await enrichActivitiesWithImages([
      { title: 'K-Flavors Buffet', image: '' },
      { title: 'Burnham Park', image: '' },
    ]);

    expect(out[0].image).toBe('/images/kflavors_taranagala.JPG');
    expect(out[1].image).toBe('/images/burnham.png');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('applies the curated photo inside a mixed batch', async () => {
    const out = await enrichActivitiesWithImages([
      { title: 'Agara Ramen', image: '' },
      { title: 'Some Uncurated Place XYZ', lat: 16.4, lon: 120.6, image: '' },
    ]);

    expect(out[0].image).toBe('/images/agara_ramen.jpg');
  });

  it('overrides a wrong incoming image with the curated photo', async () => {
    const out = await enrichActivitiesWithImages([
      { title: 'KoCo Cafe', image: 'https://images.unsplash.com/photo-somewhere-else' },
    ]);

    expect(out[0].image).toBe('/images/koco_cafe.jpg');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
