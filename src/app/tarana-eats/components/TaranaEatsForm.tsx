import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TaranaEatsFormValues } from "@/types/tarana-eats";
import { 
  cuisineOptions, 
  paxOptions, 
  dietaryOptions, 
  mealTypeOptions 
} from "../data/formOptions";

interface TaranaEatsFormProps {
  onGenerate: (results: any) => void;
  isLoading?: boolean;
}

export default function TaranaEatsForm({ onGenerate, isLoading = false }: TaranaEatsFormProps) {
  const [formValues, setFormValues] = useState<TaranaEatsFormValues>({
    budget: "",
    cuisine: cuisineOptions[0],
    pax: null,
    restrictions: [],
    mealType: [],
  });

  const updateFormValue = <K extends keyof TaranaEatsFormValues>(
    key: K, 
    value: TaranaEatsFormValues[K]
  ) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  };

  const toggleArrayValue = (key: "restrictions" | "mealType", value: string) => {
    setFormValues(prev => {
      const currentValues = prev[key];
      return {
        ...prev,
        [key]: currentValues.includes(value)
          ? currentValues.filter(item => item !== value)
          : [...currentValues, value]
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(formValues);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6">
      <h2 className="text-2xl font-bold mb-2">Where to Eat? We Got You.</h2>
      <p className="text-gray-500 mb-6">Enter your budget and group size. We&apos;ll show you cafés and meals that fit.</p>
      
      <div className="mb-8">
        <label className="block text-sm font-medium mb-1">Enter your Budget</label>
        <Input
          type="text"
          placeholder="Enter your Budget Range"
          value={formValues.budget}
          onChange={(e) => updateFormValue("budget", e.target.value)}
          className="w-full rounded-xl"
        />
      </div>
      
      <div className="mb-8">
        <label className="block text-sm font-medium mb-1">Number of Pax.</label>
        <div className="flex gap-2 lg:mr-48">
          {paxOptions.map(opt => (
            <Button
              key={opt.label}
              type="button"
              variant="outline"
              onClick={() => updateFormValue("pax", opt.value)}
              className={cn(
                'flex items-center justify-center gap-1 py-3 w-full font-medium transition',
                formValues.pax === opt.value
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
        <label className="block text-sm font-medium mb-1">Enter your Cuisine Preference</label>
        <select 
          value={formValues.cuisine} 
          onChange={e => updateFormValue("cuisine", e.target.value)} 
          className="w-full border rounded-xl px-3 py-2"
        >
          {cuisineOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
      
      <div className="mb-8">
        <label className="block text-sm font-medium mb-1">Dietary Restrictions (Optional)</label>
        <div className="flex gap-2 lg:mr-48">
          {dietaryOptions.map((opt) => (
            <Button
              key={opt.label}
              type="button"
              variant="outline"
              onClick={() => toggleArrayValue("restrictions", opt.label)}
              className={cn(
                "flex items-center justify-center gap-1 py-3 w-full font-medium transition",
                formValues.restrictions.includes(opt.label)
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
              onClick={() => toggleArrayValue("mealType", opt.label)}
              className={cn(
                'flex items-center justify-center gap-2 py-3 font-medium transition',
                formValues.mealType.includes(opt.label)
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
      
      <Button 
        type="submit" 
        disabled={isLoading}
        className="w-full font-semibold rounded-xl py-3 text-lg flex items-center justify-center gap-2 transition bg-gradient-to-b from-blue-700 to-blue-500 hover:from-blue-700 hover:to-purple-500 text-white"
      >
        {isLoading ? "Finding Meals..." : "View Meal Suggestions"} 
        {!isLoading && <span className="ml-2">→</span>}
      </Button>
    </form>
  );
} 