import 'dotenv/config';
import { enhanceItinerary } from '../src/app/itinerary-generator/services/itineraryService';
import { sampleItinerary } from '../src/app/itinerary-generator/data/itineraryData';

async function main() {
  // Simulate what the server now sends for Manila (accurate per-place images)
  const serverManila = {
    title: "Manila Itinerary",
    subtitle: "Curated recommendations based on your preferences",
    items: [{
      period: "Day 1 - Morning",
      activities: [
        { title: "Vatel Restaurant Manila", image: "https://images.unsplash.com/photo-vatel", desc: "x", tags: ["french","Food & Culinary","Indoor-Friendly"] },
        { title: "Arirang Hotel & Restaurant Manila", image: "https://api.tomtom.com/map/1/staticimage?x", desc: "x", tags: ["hotel","Food & Culinary"] },
        { title: "San Agustin Museum", image: "", desc: "x", tags: ["museum","Culture & Arts"] }, // empty → fuzzy fill allowed
        { title: "Kaya Korean Restaurant Manila", image: "https://upload.wikimedia.org/wikipedia/kaya.jpg", desc: "x", tags: ["korean","Food & Culinary"] },
      ],
    }],
  } as any;

  const out = enhanceItinerary(serverManila, null);
  const acts = out.items[0].activities;
  let fail = 0;
  for (const a of acts) {
    const img = String(a.image ?? "");
    const isBaguioLocal = img.startsWith("/images/") && !img.includes("comingsoon");
    const ok = a.title === "San Agustin Museum" ? true : !isBaguioLocal; // only empty-img may fuzzy-fill
    if (!ok) fail++;
    console.log(`${ok ? "✅" : "❌"} ${a.title} → ${img.slice(0, 60)}`);
  }
  const sanAgustin = acts.find(a => a.title === "San Agustin Museum")!;
  console.log(`San Agustin (empty→filled): ${String(sanAgustin.image).slice(0, 50)} ${sanAgustin.image ? "(fuzzy-filled)" : "(comingsoon fallback)"}`);
  console.log(fail === 0 ? "\nIMAGE-PRESERVATION PASS ✅" : `\nFAIL ❌ (${fail} overwritten)`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error("FAIL", e); process.exit(1); });
