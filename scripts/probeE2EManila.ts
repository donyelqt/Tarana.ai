import 'dotenv/config';
import { findAndScoreActivities } from '../src/app/api/gemini/itinerary-generator/lib/activitySearch';
import { GuaranteedJsonEngine } from '../src/app/api/gemini/itinerary-generator/lib/guaranteedJsonEngine';
import { geminiModel } from '../src/app/api/gemini/itinerary-generator/lib/config';

const BAGUIO_TITLES = [
  'Burnham Park', 'Mines View Park', 'Baguio Cathedral', 'Botanical Garden', 'The Mansion',
  'Wright Park', 'Camp John Hay', 'Bencab Museum', "Tam-Awan Village", 'Baguio Night Market',
  'SM City Baguio', 'Baguio Public Market', 'Good Shepherd Convent', 'Diplomat Hotel',
  'Lions Head', 'Mt. Kalugong', 'Valley of Colors', 'Korean Palace Kung Jeon',
];

async function main() {
  console.log('=== STEP 1: Retrieval (manila, traffic-aware) ===');
  const retrieval = await findAndScoreActivities(
    'Create a personalized 1 Day-day itinerary for Manila',
    ['Culture & Arts'],
    'cloudy' as any,
    1,
    (geminiModel as any) ?? null,
    true,
    'manila'
  );
  const allowed = retrieval?.searchMetadata?.allowedActivities ?? [];
  console.log(`retrieved candidates: ${allowed.length} → ${allowed.map((a: any) => a.title).slice(0, 5)}`);

  console.log('\n=== STEP 2: Composer (Gemini generateContent with NEW key) ===');
  const detailedPrompt = `Create a personalized 1 Day-day itinerary for Manila. Only use these activities: ${allowed.map((a: any) => a.title).join(', ')}`;
  const final = await GuaranteedJsonEngine.generateGuaranteedJson(
    detailedPrompt,
    retrieval,
    'Weather: light rain, 17°C',
    'No peak-hour activities allowed',
    'Duration: 1 days, Budget: less than ₱3,000/day, Pax: 2',
    'probe_e2e'
  );

  const acts: Array<{ title: string }> = [];
  for (const section of final?.items ?? []) for (const a of section.activities ?? []) acts.push(a);
  console.log(`\nFINAL ITINERARY title: "${final?.title}"`);
  console.log(`FINAL subtitle: "${final?.subtitle}"`);
  console.log(`total activities: ${acts.length}`);
  console.log('titles:', acts.map(a => a.title));
  const leaked = acts.filter(a => BAGUIO_TITLES.includes(a.title));
  console.log(`BAGUIO LEAKAGE: ${leaked.length === 0 ? 'NONE ✅' : `${leaked.length} ❌`}`);
  if (acts.length === 0) { console.error('❌ STILL EMPTY'); process.exit(1); }
  console.log('\nE2E PASS ✅');
}
main().catch(e => { console.error('FAIL', e); process.exit(1); });
