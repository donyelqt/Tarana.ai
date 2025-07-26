import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Leaf, Vegan, BadgeCheck, Coffee, Soup, Moon, Cookie } from "lucide-react";

interface TaranaEatsFormProps {
  onGenerate: (results: any) => void;
}

const cuisineOptions = [
  "Filipino",
  "Ilocano/Cordilleran",
  "Korean",
  "Chinese",
  "Japanese",
  "Thai",
  "Middle Eastern",
  "Show All",
];

const paxOptions = [
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3-5", value: 4 },
  { label: "6+", value: 6 },
];

const dietaryOptions = [
  { label: "Vegetarian", icon: <Leaf className="w-4 h-4" /> },
  { label: "Halal", icon: <BadgeCheck className="w-4 h-4" /> },
  { label: "Vegan", icon: <Vegan className="w-4 h-4" /> },
];

const mealTypeOptions = [
  { label: "Breakfast", icon: <Coffee className="w-4 h-4" /> },
  { label: "Lunch", icon: <Soup className="w-4 h-4" /> },
  { label: "Dinner", icon: <Moon className="w-4 h-4" /> },
  { label: "Snack", icon: <Cookie className="w-4 h-4" /> },
];

export default function TaranaEatsForm({ onGenerate }: TaranaEatsFormProps) {
  const [budget, setBudget] = useState("");
  const [cuisine, setCuisine] = useState("Japanese Food");
  const [pax, setPax] = useState<number | null>(null);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [mealType, setMealType] = useState<string[]>([]);

  const handleRestriction = (value: string) => {
    setRestrictions((prev) =>
      prev.includes(value)
        ? prev.filter((r) => r !== value)
        : [...prev, value]
    );
  };

  const handleMealType = (value: string) => {
    setMealType((prev) =>
      prev.includes(value)
        ? prev.filter((m) => m !== value)
        : [...prev, value]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate generation
    onGenerate({
      matches: [
        {
          name: "Hill Station",
          meals: 3,
          price: 150,
          image: "/images/hillstation.png",
        },
        {
          name: "Itaewon Cafe",
          meals: 2,
          price: 150,
          image: "/images/itaewon.png",
        },
      ],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6">
      <h2 className="text-2xl font-bold mb-2">Where to Eat? We Got You.</h2>
      <p className="text-gray-500 mb-6">Enter your budget and group size. We&apos;ll show you cafés and meals that fit.</p>
      <div className="mb-8">
        <label className="block text-sm font-medium mb-2">Preferences</label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input
              type="text"
              placeholder="Enter your Budget Range"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full rounded-xl"
            />
          </div>
          <div>
            <select value={cuisine} onChange={e => setCuisine(e.target.value)} className="w-full border rounded-xl px-3 py-2 h-10">
              {cuisineOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="mb-8">
        <label className="block text-sm font-medium mb-1">Number of Pax.</label>
        <div className="flex gap-2 lg:mr-48">
          {paxOptions.map(opt => (
            <Button
              key={opt.label}
              type="button"
              variant="outline"
              onClick={() => setPax(opt.value)}
              className={cn(
                'flex items-center justify-center gap-1 py-3 w-full font-medium transition',
                pax === opt.value
                  ? 'bg-gradient-to-b from-blue-700 to-blue-500 hover:from-blue-700 text-white border-blue-500'
                  : 'bg-white border-gray-300 text-gray-700'
              )}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="mb-8">
        <label className="block text-sm font-medium mb-1">Dietary Restrictions (Optional)</label>
        <div className="flex gap-2 lg:mr-48">
          {dietaryOptions.map((opt) => (
            <Button
              key={opt.label}
              type="button"
              variant="outline"
              onClick={() => handleRestriction(opt.label)}
              className={cn(
                "flex items-center justify-center gap-1 py-3 w-full font-medium transition",
                restrictions.includes(opt.label)
                  ? 'bg-gradient-to-b from-blue-700 to-blue-500 hover:from-blue-700 text-white border-blue-500'
                  : 'bg-white border-gray-300 text-gray-700'
              )}
            >
              <span className="mr-2">{opt.icon}</span>
              {opt.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="mb-8">
        <label className="block text-sm font-medium mb-1">Meal Type</label>
        <div className="grid grid-cols-2 gap-2">
          {mealTypeOptions.map((opt) => (
            <Button
              key={opt.label}
              type="button"
              variant="outline"
              onClick={() => handleMealType(opt.label)}
              className={cn(
                'flex items-center justify-center gap-2 py-3 font-medium transition',
                mealType.includes(opt.label)
                  ? 'bg-gradient-to-b from-blue-700 to-blue-500 hover:from-blue-700 text-white border-blue-500'
                  : 'bg-white border-gray-300 text-gray-700'
              )}
            >
              {opt.icon}
              {opt.label}
            </Button>
          ))}
        </div>
      </div>
      <Button type="submit" className="w-full font-semibold rounded-xl py-3 text-lg flex items-center justify-center gap-2 transition bg-gradient-to-b from-blue-700 to-blue-500 hover:from-blue-700 hover:to-purple-500 text-white">
        View Meal Suggestions <span className="ml-2">→</span>
      </Button>
    </form>
  );
}
