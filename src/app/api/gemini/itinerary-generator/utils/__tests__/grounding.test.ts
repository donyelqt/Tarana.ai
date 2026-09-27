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

  test('replaces untrusted model images with comingsoon', () => {
    const it = itineraryWith(
      [{ period: 'Day 1 - Morning', activities: [{ title: 'Burnham Park', desc: 'Canonical desc.', image: 'https://evil.example/pixel.jpg' }] }],
      [{ title: 'Burnham Park', desc: 'Canonical desc.' }]
    );
    const out = organizeItineraryByDays(it, 1);
    expect(out.items[0].activities[0].image).toBe('/images/comingsoon.png');
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
