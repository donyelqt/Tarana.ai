import Link from "next/link";
import { Coffee, Croissant, Trash2, Utensils, UtensilsCrossed, Wine } from "lucide-react";

export interface SavedMealCardItem { name?: unknown; price?: unknown; quantity?: unknown }
export interface SavedMealCardGroup {
  cafeName?: unknown;
  type?: unknown;
  totalPrice?: unknown;
  goodFor?: unknown;
  items?: unknown;
  image?: unknown;
}
export interface SavedMealIndividualCard extends SavedMealCardGroup {
  id?: unknown;
  mealType?: unknown;
  price?: unknown;
}
export interface SavedMealCustomCardsProps {
  combinedSavedMeals?: SavedMealCardGroup[] | null;
  individualSavedMeals?: SavedMealIndividualCard[] | null;
  selectedMealId?: string | null;
  onViewMealCard: (meal: { id: string; type: string; items: Array<{ name: string; price: number; quantity: number; image?: string }>; totalPrice: number; goodFor: number }) => void;
  onDeleteCombinedMeal: () => void;
  onDeleteIndividualMeal: (id: string) => void;
}

interface SanitizedItem {
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface SanitizedGroup {
  cafeName: string | null;
  type: string | null;
  totalPrice: number;
  goodFor: number;
  items: SanitizedItem[];
  image?: string | null;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPax(value: unknown): number {
  const parsed = toFiniteNumber(value, NaN);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.max(1, Math.floor(parsed));
}

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
function toImageSrc(value: unknown): string | null {
  const src = toTrimmedString(value);
  if (!src) return null;
  if (src.startsWith('/') && !src.startsWith('//')) return src;
  try {
    const url = new URL(src);
    return url.protocol === 'http:' || url.protocol === 'https:' ? src : null;
  } catch {
    return null;
  }
}

function initialsFor(value: string | null): string {
  if (!value) return 'M';
  const words = value.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.slice(0, 2).map((word) => word[0]) : [words[0]?.[0] ?? 'M']).join('').toUpperCase();
}

function PreviewImage({ src, fallback }: { src?: string | null; fallback: string | null }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={40}
        height={40}
        loading="lazy"
        decoding="async"
        className="h-10 w-10 shrink-0 rounded-xl object-cover bg-gray-100"
      />
    );
  }

  return (
    <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-xs font-bold text-blue-800">
      {initialsFor(fallback)}
    </div>
  );
}

function sanitizeItem(item: unknown): SanitizedItem {
  const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
  const name = toTrimmedString(record.name) ?? "Menu item";
  const price = toFiniteNumber(record.price, 0);
  const rawQuantity = toFiniteNumber(record.quantity, NaN);
  const quantity = Number.isFinite(rawQuantity) && rawQuantity >= 1 ? Math.floor(rawQuantity) : 1;
  const image = toImageSrc(record.image);
  return image ? { name, price, quantity, image } : { name, price, quantity };
}

function sanitizeItems(value: unknown): SanitizedItem[] {
  if (!Array.isArray(value)) return [];
  return value.map(sanitizeItem);
}

function sanitizeGroup(group: unknown): SanitizedGroup {
  const record = group && typeof group === "object" ? (group as Record<string, unknown>) : {};
  return {
    cafeName: toTrimmedString(record.cafeName),
    type: toTrimmedString(record.type),
    totalPrice: toFiniteNumber(record.totalPrice, 0),
    goodFor: toPax(record.goodFor),
    items: sanitizeItems(record.items),
    image: toImageSrc(record.image),
  };
}

function sanitizeGroups(value: unknown): SanitizedGroup[] {
  if (!Array.isArray(value)) return [];
  return value.map(sanitizeGroup);
}

function formatPeso(value: number): string {
  return toFiniteNumber(value, 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function MealTypeIcon({ type, className }: { type: string; className?: string }) {
  const normalized = type.trim();
  if (normalized === "Breakfast") return <Coffee aria-hidden="true" className={className} />;
  if (normalized === "Snack" || normalized === "Snacks") return <Croissant aria-hidden="true" className={className} />;
  if (normalized === "Drinks") return <Wine aria-hidden="true" className={className} />;
  return <Utensils aria-hidden="true" className={className} />;
}

function buildCombinedPreview(groups: SanitizedGroup[]): string {
  return groups
    .map((group) => {
      const names = group.items.map((item) => item.name).join(" · ");
      if (group.cafeName) return names ? `${group.cafeName}: ${names}` : group.cafeName;
      return names;
    })
    .filter((segment) => segment.length > 0)
    .join("; ");
}

function buildIndividualPreview(items: SanitizedItem[]): string {
  return items
    .map((item) => (item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name))
    .join(" · ");
}

export default function SavedMealCustomCards({
  combinedSavedMeals,
  individualSavedMeals,
  selectedMealId,
  onViewMealCard,
  onDeleteCombinedMeal,
  onDeleteIndividualMeal,
}: SavedMealCustomCardsProps) {
  const combinedGroups = sanitizeGroups(combinedSavedMeals);
  const hasCombined = combinedGroups.length > 0;
  const individualNumberOffset = hasCombined ? 2 : 1;
  const individuals = (Array.isArray(individualSavedMeals) ? individualSavedMeals : []).map((individual, index) => {
    const customNumber = index + individualNumberOffset;
    const rawId = individual && typeof individual === "object" ? (individual as SavedMealIndividualCard).id : undefined;
    const id = rawId === undefined || rawId === null ? `custom-meal-${customNumber}` : String(rawId);
    const record = individual && typeof individual === "object" ? (individual as Record<string, unknown>) : {};
    const items = sanitizeItems(record.items);
    const mealType = toTrimmedString(record.mealType);
    return {
      id,
      customNumber,
      mealType,
      typeLabel: mealType ?? "Meal",
      items,
      totalPrice: toFiniteNumber(record.price, 0),
      goodFor: toPax(record.goodFor),
      cafeName: toTrimmedString(record.cafeName),
      image: toImageSrc(record.image),
    };
  });

  const combinedItems = combinedGroups.flatMap((group) => group.items);
  const combinedTotal = combinedGroups.reduce((sum, group) => sum + group.totalPrice, 0);
  const combinedGoodFor = combinedGroups.length > 0 ? Math.max(...combinedGroups.map((group) => group.goodFor)) : 1;
  const combinedTypeLabel = combinedGroups.map((group) => group.type).find((type): type is string => !!type) ?? "Combined";
  const combinedDishCount = combinedItems.length;
  const combinedPreview = buildCombinedPreview(combinedGroups);
  const combinedPreviewImage = combinedGroups[0]?.items[0]?.image ?? combinedGroups[0]?.image ?? null;
  const combinedPreviewFallback = combinedGroups[0]?.cafeName ?? null;

  const cardCount = (hasCombined ? 1 : 0) + individuals.length;
  const isEmpty = cardCount === 0;

  return (
    <section
      aria-labelledby="your-saved-meals-heading"
      className="bg-white rounded-3xl border border-gray-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-4 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 id="your-saved-meals-heading" className="text-xl sm:text-2xl font-bold text-gray-900">
          Your Saved Meals
        </h2>
        <span className="text-sm text-gray-500 tabular-nums whitespace-nowrap">
          {cardCount} {cardCount === 1 ? "card" : "cards"}
        </span>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center text-center py-12 px-4">
          <UtensilsCrossed aria-hidden="true" className="w-10 h-10 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No meal cards yet</h3>
          <p className="mt-1 text-sm text-gray-500 max-w-xs">
            Save meals from Tarana Eats and they will appear here.
          </p>
          <Link
            href="/tarana-eats"
            className="mt-5 inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Find meals
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {hasCombined && (
            <article
              aria-current={selectedMealId === "custom-meal-1" ? "true" : undefined}
              className={`grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3 py-4 sm:py-5 px-2 sm:px-3 ${selectedMealId === "custom-meal-1" ? "bg-blue-50" : ""}`}
            >
              <PreviewImage src={combinedPreviewImage} fallback={combinedPreviewFallback} />
              <div className="min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedMealId === "custom-meal-1" && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5">
                        Selected
                      </span>
                    )}
                    <h3 className="text-lg font-bold text-gray-900">Custom Meal 1</h3>
                    <span className="text-xs text-gray-400 tabular-nums">
                      {combinedDishCount} {combinedDishCount === 1 ? "item" : "items"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <MealTypeIcon type={combinedTypeLabel} className="w-5 h-5" />
                  <span className="text-sm font-medium">{combinedTypeLabel}</span>
                </div>
              </div>

              {combinedPreview && (
                <p className="mt-2 text-sm text-gray-600 leading-snug line-clamp-2 break-words">
                  {combinedPreview}
                </p>
              )}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">₱{formatPeso(combinedTotal)}</p>
                  <p className="mt-0.5 text-sm text-gray-500">Good for {combinedGoodFor} pax</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    aria-label="View saved meal card 1"
                    onClick={() =>
                      onViewMealCard({
                        id: "custom-meal-1",
                        type: "Combined",
                        items: combinedItems,
                        totalPrice: combinedTotal,
                        goodFor: combinedGoodFor,
                      })
                    }
                    className="flex-1 sm:flex-none min-h-[44px] px-5 inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-blue-700 to-blue-500 hover:to-blue-700 text-white text-sm font-semibold shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    View Meal Card
                  </button>
                  <button
                    type="button"
                    aria-label="Delete saved meal 1"
                    onClick={onDeleteCombinedMeal}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-gray-300 text-red-500 hover:text-red-600 hover:bg-red-50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                  >
                    <Trash2 aria-hidden="true" className="w-5 h-5" />
                  </button>
                </div>
              </div>
              </div>
            </article>
          )}

          {individuals.map((individual) => {
            const isSelected = selectedMealId === individual.id;
            const dishCount = individual.items.length;
            const preview = buildIndividualPreview(individual.items);
            const previewImage = individual.items[0]?.image ?? individual.image ?? null;
            const previewFallback = individual.cafeName;
            return (
              <article
                key={individual.id}
                aria-current={isSelected ? "true" : undefined}
                className={`grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3 py-4 sm:py-5 px-2 sm:px-3 ${isSelected ? "bg-blue-50" : ""}`}
              >
                <PreviewImage src={previewImage} fallback={previewFallback} />
                <div className="min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {isSelected && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5">
                          Selected
                        </span>
                      )}
                      <h3 className="text-lg font-bold text-gray-900">Custom Meal {individual.customNumber}</h3>
                      <span className="text-xs text-gray-400 tabular-nums">
                        {dishCount} {dishCount === 1 ? "item" : "items"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MealTypeIcon type={individual.typeLabel} className="w-5 h-5" />
                    <span className="text-sm font-medium">{individual.typeLabel}</span>
                  </div>
                </div>

                {preview && (
                  <p className="mt-2 text-sm text-gray-600 leading-snug line-clamp-2 break-words">
                    {preview}
                  </p>
                )}

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">₱{formatPeso(individual.totalPrice)}</p>
                    <p className="mt-0.5 text-sm text-gray-500">Good for {individual.goodFor} pax</p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      aria-label={`View saved meal card ${individual.customNumber}`}
                      onClick={() =>
                        onViewMealCard({
                          id: individual.id,
                          type: individual.mealType ?? "SavedMeal",
                          items: individual.items,
                          totalPrice: individual.totalPrice,
                          goodFor: individual.goodFor,
                        })
                      }
                      className="flex-1 sm:flex-none min-h-[44px] px-5 inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-blue-700 to-blue-500 hover:to-blue-700 text-white text-sm font-semibold shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    >
                      View Meal Card
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete saved meal ${individual.customNumber}`}
                      onClick={() => onDeleteIndividualMeal(individual.id)}
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-gray-300 text-red-500 hover:text-red-600 hover:bg-red-50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                    >
                      <Trash2 aria-hidden="true" className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
