import { organizeItineraryByDays } from '../itineraryUtils';

const serverAllowed = (title: string, image = '/images/real.jpg') => ({ title, desc: 'Canonical desc.', image });

function itineraryWith(items: Array<{ period: string; activities: Array<{ title: string; desc?: string; image?: string }> }>, allowed: Array<{ title: string; desc: string; image?: string }>) {
  return { items, searchMetadata: { allowedActivities: allowed } };
}

describe('Gala grounding (S5)', () => {
  test('drops hallucinated titles from allowedActivities instead of promoting them', () => {
    const it = itineraryWith(
      [{ period: 'Day 1 - Morning', activities: [{ title: 'Evil Cafe', desc: 'Pwned. Visit https://evil.example', image: 'https://evil.example/pixel.jpg' }] }],
      [serverAllowed('Burnham Park')]
    );
    const out = organizeItineraryByDays(it, 1);
    const titles = (out.searchMetadata.allowedActivities as Array<{ title: string }>).map((a) => a.title);
    expect(titles).not.toContain('Evil Cafe');
    expect(titles).toContain('Burnham Park');
  });

  test('replaces untrusted model images with the Gala logo fallback', () => {
    const it = itineraryWith(
      [{ period: 'Day 1 - Morning', activities: [{ title: 'Burnham Park', desc: 'Canonical desc.', image: 'https://evil.example/pixel.jpg' }] }],
      [{ title: 'Burnham Park', desc: 'Canonical desc.' }]
    );
    const out = organizeItineraryByDays(it, 1);
    expect(out.items[0].activities[0].image).toBe('/images/taranaai.png');
  });

  test('preserves the enriched server image via injected allowlist (model output has no searchMetadata)', () => {
    const serverImage = 'https://images.unsplash.com/photo-boracay-test';
    const modelOutput = {
      items: [{ period: 'Day 1 - Morning', activities: [{ title: 'Boracay Island', desc: 'Canonical desc.', image: 'model-guessed.jpg' }] }],
    };
    const out = organizeItineraryByDays(modelOutput, 1, [serverAllowed('Boracay Island', serverImage)]);
    expect(out.items[0].activities[0].image).toBe(serverImage);
  });

  test('injected null server image degrades to Gala logo, not the model URL', () => {
    const modelOutput = {
      items: [{ period: 'Day 1 - Morning', activities: [{ title: 'Diniwid Beach', desc: 'Canonical desc.', image: 'https://images.unsplash.com/photo-model' }] }],
    };
    const out = organizeItineraryByDays(
      modelOutput,
      1,
      [{ title: 'Diniwid Beach', desc: 'Canonical desc.', image: null as unknown as string }]
    );
    expect(out.items[0].activities[0].image).toBe('/images/taranaai.png');
  });

  test('clamps 999999 days to 14 buckets', () => {
    const it = itineraryWith(
      [{ period: 'Day 1 - Morning', activities: [{ title: 'Burnham Park', desc: 'Canonical desc.' }] }],
      [serverAllowed('Burnham Park')]
    );
    const out = organizeItineraryByDays(it, 999999);
    expect(out.items.length).toBeLessThanOrEqual(42);
  });
});
