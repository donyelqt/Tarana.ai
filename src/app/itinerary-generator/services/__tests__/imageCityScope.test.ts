
import { enhanceItinerary } from '../itineraryService';
import { sampleItinerary } from '../../data/itineraryData';

const BAGUIO_NIGHT_MARKET = sampleItinerary.items
  .flatMap((s) => s.activities)
  .find((a) => a.title === 'Baguio Night Market');
const MINES_VIEW_PARK = sampleItinerary.items
  .flatMap((s) => s.activities)
  .find((a) => a.title === 'Mines View Park');

function itineraryWith(activities: Array<{ title: string; image?: string; tags?: string[] }>) {
  return {
    title: 'Manila Itinerary',
    subtitle: '1-day shopping',
    items: [
      { period: 'Day 1 - Morning', activities: activities.map((a) => ({ time: '9:00-11:00AM', desc: 'd', ...a })) },
      { period: 'Day 1 - Afternoon', activities: [] },
      { period: 'Day 1 - Evening', activities: [] },
    ],
  } as never;
}

const firstImage = (out: ReturnType<typeof enhanceItinerary>) =>
  (out.items[0].activities as Array<{ image: unknown }>)[0].image;

describe('cross-city curated image bleed', () => {
  it('fixtures resolved: the Baguio catalog really holds those two photos', () => {
    expect(BAGUIO_NIGHT_MARKET?.image).toBeDefined();
    expect(MINES_VIEW_PARK?.image).toBeDefined();
  });

  it('does not give a Manila market the Baguio Night Market photo', () => {
    const out = enhanceItinerary(
      itineraryWith([{ title: 'Poblacion Market', image: '', tags: ['Shopping & Local Finds'] }]),
      null,
      'manila'
    );
    expect(firstImage(out)).not.toBe(BAGUIO_NIGHT_MARKET?.image);
  });

  it('does not give a Manila supermarket the Mines View Park photo', () => {
    const out = enhanceItinerary(
      itineraryWith([{ title: 'Robinsons Supermarket Tutuban', image: '', tags: ['Shopping & Local Finds'] }]),
      null,
      'manila'
    );
    expect(firstImage(out)).not.toBe(MINES_VIEW_PARK?.image);
  });

  it('never returns another city photo for ANY non-Baguio city', () => {
    const baguioImages = new Set(
      sampleItinerary.items.flatMap((s) => s.activities).map((a) => a.image)
    );
    for (const cityId of ['manila', 'cebu', 'davao', 'boracay', 'el_nido', 'world', 'ph-wide'] as const) {
      const out = enhanceItinerary(
        itineraryWith([{ title: 'Poblacion Market', image: '', tags: ['Shopping & Local Finds'] }]),
        null,
        cityId
      );
      expect(baguioImages.has(firstImage(out) as never)).toBe(false);
    }
  });

  it('still resolves Baguio curated images (no over-correction)', () => {
    const out = enhanceItinerary(
      itineraryWith([{ title: 'Baguio Night Market', image: '', tags: ['Shopping & Local Finds'] }]),
      null,
      'baguio'
    );
    expect(firstImage(out)).toBe(BAGUIO_NIGHT_MARKET?.image);
  });

  it('still keeps a server-resolved image untouched in any city', () => {
    const serverUrl = 'https://images.unsplash.com/photo-poblacion-market';
    const out = enhanceItinerary(
      itineraryWith([{ title: 'Poblacion Market', image: serverUrl, tags: ['Shopping & Local Finds'] }]),
      null,
      'manila'
    );
    expect(firstImage(out)).toBe(serverUrl);
  });
});
