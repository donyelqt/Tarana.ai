/**
 * Local itinerary generator — llama.rn behind the shared Gala contract.
 *
 * One day at a time. A 1.7B model degrades sharply on one long JSON document;
 * N short calls each producing a `Morning/Afternoon/Evening` section keep
 * every prompt small and every output parseable. Failure is bounded to one
 * day, and a failed day degrades to an honest placeholder section rather than
 * losing the trip.
 *
 * Grammar-constrained sampling (llama.rn `json_schema` response format) makes
 * the output syntactically valid by construction. The shared Zod schema
 * (`tarana-web/data/itinerarySchema`) still validates semantics at the
 * boundary; the retry ladder covers the cases grammar cannot.
 *
 * Retrieval honesty: the model invents stop titles. It has no curated
 * catalog, so generated stops carry no images and no coordinates beyond what
 * the caller resolves. This matches the web behavior of writing
 * `activity_coordinates` separately at save time.
 */
import { itineraryDataSchema, type ItinerarySection } from 'tarana-web/data/itinerarySchema';
import { getModelStatus, isLlamaAvailable, MODEL_PATH } from './modelManager';
import { buildDayPrompt, SLOTS } from './prompt';
import type { PlanInput } from '../data';

const MODEL_CONTEXT = 4096;

/** Minimal JSON-schema subset llama.rn accepts for grammar-constrained sampling. */
const sectionJsonSchema = {
  type: 'object',
  properties: {
    period: { type: 'string' },
    activities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          time: { type: 'string' },
          desc: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          image: { type: ['string', 'null'] },
        },
        required: ['title', 'time', 'desc', 'tags'],
      },
    },
    reason: { type: 'string' },
  },
  required: ['period', 'activities'],
} as const;

function fallbackSection(dayIndex: number, slot: string, reason: string): ItinerarySection {
  return {
    period: `Day ${dayIndex + 1} ${slot}`,
    activities: [],
    reason,
  };
}

/** Parse a model response that may be wrapped in markdown fences or prose. */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    // Model prose around the JSON: take the outermost braces.
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function validateSection(value: unknown, dayIndex: number, slot: string): ItinerarySection | null {
  if (typeof value !== 'object' || value === null) return null;
  const withDay = value as Record<string, unknown>;
  // Force the period label to carry the day marker so TripDetail's day
  // grouping (which keys on "morning") stays correct regardless of what the
  // model wrote.
  const result = itineraryDataSchema.shape.items.element.safeParse(withDay);
  if (!result.success) return null;
  const section = result.data;
  return { ...section, period: `Day ${dayIndex + 1} ${slot}` };
}

export type LocalGenerationResult = {
  title: string;
  subtitle: string;
  items: ItinerarySection[];
  modelPath: string;
};

export async function generateWithLlama(
  input: PlanInput,
  onProgress?: (message: string) => void
): Promise<LocalGenerationResult> {
  if (!isLlamaAvailable()) throw new Error('The local model engine is unavailable in this build.');
  const status = await getModelStatus();
  if (status.state !== 'ready' || !status.path) {
    throw new Error('Download the local model before generating a plan.');
  }

  // Lazy require: keeps llama.rn out of the module graph until this file runs,
  // and keeps the Jest environment (no native module) import-safe.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Llama: unknown = require('llama.rn');
  if (typeof Llama !== 'object' || Llama === null || !('initLlama' in Llama)) {
    throw new Error('The local model engine is unavailable in this build.');
  }
  const { initLlama } = Llama as { initLlama: (opts: Record<string, unknown>) => Promise<LlamaContext> };

  onProgress?.('Loading the local model…');
  const context = await initLlama({
    model: MODEL_PATH,
    n_ctx: MODEL_CONTEXT,
    n_gpu_layers: 'auto',
  });

  const items: ItinerarySection[] = [];
  const priorTitles: string[] = [];

  try {
    for (let day = 0; day < input.days; day++) {
      for (const slot of SLOTS) {
        onProgress?.(`Planning Day ${day + 1} · ${slot}…`);
        const prompt = buildDayPrompt(input, day, priorTitles);
        let section: ItinerarySection | null = null;

        // Ladder: grammar-constrained first pass, one low-temperature retry
        // with the grammar dropped, then an honest placeholder. Grammar makes
        // the first pass almost always succeed; the retry covers context
        // truncation, and the placeholder means a bad day never loses a trip.
        for (let attempt = 0; attempt < 2 && !section; attempt++) {
          try {
            const completion = await context.completion(
              attempt === 0
                ? {
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_schema', json_schema: { schema: sectionJsonSchema, strict: true } },
                    temperature: 0.3,
                    max_tokens: 700,
                  }
                : {
                    messages: [
                      { role: 'user', content: `${prompt}\nRespond with raw JSON only. No markdown, no prose.` },
                    ],
                    temperature: 0.2,
                    max_tokens: 700,
                  }
            );
            const parsed = extractJson(completion.text ?? '');
            section = validateSection(parsed, day, slot);
          } catch {
            section = null;
          }
        }

        if (section) {
          for (const a of section.activities) priorTitles.push(a.title);
          items.push(section);
        } else {
          items.push(
            fallbackSection(
              day,
              slot,
              'The model could not plan this slot reliably. Re-run it or edit the day by hand.'
            )
          );
        }
      }
    }
  } finally {
    context.release?.();
  }

  const payload = itineraryDataSchema.safeParse({
    title: `${input.days}-day trip to ${input.city}`,
    subtitle: `Planned offline on your device`,
    items,
  });
  if (!payload.success) throw new Error('The generated plan failed validation.');

  return { ...payload.data, modelPath: status.path };
}

type LlamaContext = {
  completion: (opts: Record<string, unknown>) => Promise<{ text?: string }>;
  release?: () => void;
};
