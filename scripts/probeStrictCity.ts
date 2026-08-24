import 'dotenv/config';
import { findAndScoreActivities } from '../src/app/api/gemini/itinerary-generator/lib/activitySearch';

const BAGUIO_TITLES = [
  'Burnham Park', 'Mines View Park', 'Baguio Cathedral', 'Botanical Garden', 'The Mansion',
  'Wright Park', 'Camp John Hay', 'Bencab Museum', "Tam-Awan Village", 'Baguio Night Market',
  'SM City Baguio', 'Baguio Public Market', 'Good Shepherd Convent', 'Diplomat Hotel',
  'Lions Head', 'Mt. Kalugong', 'Valley of Colors', 'Korean Palace Kung Jeon', 'Oh My Gulay',
  'Hill Station', 'Agara Ramen', 'K-Flavors Buffet',
];

async function main() {
  for (const cityId of ['manila', 'cebu']) {
    console.log(`\n========== PROBE cityId=${cityId} ==========`);
    const result = await findAndScoreActivities(
      `Create a personalized 1-day itinerary for ${cityId}`,
      ['Food & Culinary'],
      'cloudy' as any,
      1,
      null,          // model — subquery expansion not needed for strict path
      false,         // trafficAware=false → fast mode, isolates retrieval correctness
      cityId
    );
    const acts: Array<{ title: string; lat?: number; lon?: number }> = [];
    for (const section of result?.items ?? []) {
      for (const a of section.activities ?? []) acts.push(a);
    }
    console.log(`total activities: ${acts.length}`);
    console.log('titles:', acts.map(a => a.title).slice(0, 10));
    const leaked = acts.filter(a => BAGUIO_TITLES.includes(a.title));
    console.log(`BAGUIO LEAKAGE: ${leaked.length === 0 ? 'NONE ✅' : `${leaked.length} ❌ ${leaked.map(l => l.title)}`}`);
    const withCoords = acts.filter(a => a.lat != null && a.lon != null);
    if (withCoords.length > 0) {
      const lats = withCoords.map(a => a.lat as number);
      const lons = withCoords.map(a => a.lon as number);
      console.log(`coord range: lat[${Math.min(...lats).toFixed(3)},${Math.max(...lats).toFixed(3)}] lon[${Math.min(...lons).toFixed(3)},${Math.max(...lons).toFixed(3)}]`);
    }
    console.log(`searchMethod sample:`, (result?.items?.[0]?.activities?.[0] as any)?.searchMethod ?? (result as any)?.searchMetadata?.searchMethod);
  }
  console.log('\nPROBE DONE');
}
main().catch(e => { console.error('FAIL', e); process.exit(1); });
