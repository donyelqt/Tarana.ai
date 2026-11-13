import Link from "next/link";
import { ArrowRight, Bookmark, Car, MapPin, Utensils, Wand2 } from "lucide-react";

const secondaryActions = [
  {
    href: "/tarana-eats",
    icon: Utensils,
    title: "Food Recommendations",
    description: "Discover your next favorite meal.",
  },
  {
    href: "/saved-trips",
    icon: Car,
    title: "Saved Trips",
    description: "Access your travel itineraries.",
  },
  {
    href: "/saved-meals",
    icon: Bookmark,
    title: "Saved Meals",
    description: "Revisit your food recommendations.",
  },
  {
    href: "/tarana-explore",
    icon: MapPin,
    title: "Explore Routes",
    description: "Smart traffic-aware navigation.",
  },
] as const;

const oneLine = "whitespace-nowrap overflow-hidden text-ellipsis";

export default function QuickActions() {
  return (
    <div role="group" aria-label="Quick actions" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-8">
      <Link
        href="/itinerary-generator"
        className="group relative min-h-32 p-4 rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white shadow-md hover:shadow-lg motion-safe:hover:-translate-y-0.5 motion-safe:transition-[transform,box-shadow] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 flex flex-col"
      >
        <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
          <Wand2 size={18} aria-hidden="true" />
        </div>
        <div className="mt-auto pr-8">
          <h3 className={`${oneLine} font-semibold text-lg leading-tight`}>New Itinerary</h3>
          <p className={`${oneLine} mt-0.5 text-xs text-blue-100`}>Generate a personalized travel plan.</p>
        </div>
        <ArrowRight size={18} aria-hidden="true" className="absolute bottom-4 right-4 transition-transform motion-safe:group-hover:translate-x-1" />
      </Link>

      {secondaryActions.map(({ href, icon: Icon, title, description }) => (
        <Link
          key={href}
          href={href}
          className="group relative min-h-32 p-4 rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-blue-200 motion-safe:hover:-translate-y-0.5 motion-safe:transition-[transform,box-shadow,border-color] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 flex flex-col"
        >
          <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
            <Icon size={16} aria-hidden="true" />
          </div>
          <div className="mt-auto pr-8">
            <h3 className={`${oneLine} font-semibold text-sm text-gray-900`}>{title}</h3>
            <p className={`${oneLine} mt-0.5 text-xs text-gray-500`}>{description}</p>
          </div>
          <ArrowRight size={16} aria-hidden="true" className="absolute bottom-4 right-4 text-blue-700 transition-transform motion-safe:group-hover:translate-x-1" />
        </Link>
      ))}
    </div>
  );
}
