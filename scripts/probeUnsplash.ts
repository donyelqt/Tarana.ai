import 'dotenv/config';
import { getAccurateImageForPlace } from '../src/lib/services/imageService';

async function main() {
  console.log('key present:', !!process.env.UNSPLASH_ACCESS_KEY, 'len:', process.env.UNSPLASH_ACCESS_KEY?.length);
  const t0 = await getAccurateImageForPlace({ title: 'Burnham Park', lat: 16.4093, lon: 120.5950 });
  console.log('TIER0 Baguio Burnham:', t0);
  const cebu = await getAccurateImageForPlace({ title: 'K-Flavors Buffet', city: 'Cebu', lat: 10.3167, lon: 123.8854 });
  console.log('CEBU K-Flavors:', String(cebu).slice(0, 110));
  const davao = await getAccurateImageForPlace({ title: 'Ramen restaurant', city: 'Davao', lat: 7.1907, lon: 125.4553 });
  console.log('DAVAO Ramen:', String(davao).slice(0, 110));
  console.log('DONE');
}
main().catch(e => { console.error('FAIL', e); });
