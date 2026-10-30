
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
    const out = await enrichActivitiesWithImages(
      [
        { title: 'K-Flavors Buffet', image: '' },
        { title: 'Burnham Park', image: '' },
      ],
      { city: 'Baguio City', cityId: 'baguio' }
    );

    expect(out[0].image).toBe('/images/kflavors_taranagala.jpg');
    expect(out[1].image).toBe('/images/burnham.png');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('applies the curated photo inside a mixed batch', async () => {
    const out = await enrichActivitiesWithImages(
      [
        { title: 'Agara Ramen', image: '' },
        { title: 'Some Uncurated Place XYZ', lat: 16.4, lon: 120.6, image: '' },
      ],
      { city: 'Baguio City', cityId: 'baguio' }
    );

    expect(out[0].image).toBe('/images/agara_ramen.jpg');
  });

  it('overrides a wrong incoming image with the curated photo', async () => {
    const out = await enrichActivitiesWithImages(
      [{ title: 'KoCo Cafe', image: 'https://images.unsplash.com/photo-somewhere-else' }],
      { city: 'Baguio City', cityId: 'baguio' }
    );

    expect(out[0].image).toBe('/images/koco_cafe.jpg');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
