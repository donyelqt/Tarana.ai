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
import { useTaranaEatsAI } from "../hooks/useTaranaEatsAI";
import { useToast } from "@/components/ui/use-toast";

import { useEffect } from "react";

interface TaranaEatsFormProps {
  onGenerate: (results: any) => void;
  isLoading?: boolean;
  onLoadingChange?: (isLoading: boolean) => void;
  initialValues?: TaranaEatsFormValues | null;
  isGenerated?: boolean;
}

export default function TaranaEatsForm({ onGenerate, isLoading = false, onLoadingChange, initialValues, isGenerated }: TaranaEatsFormProps) {
  const [formValues, setFormValues] = useState<TaranaEatsFormValues>(initialValues || {
    budget: "",
    cuisine: cuisineOptions[0],
    pax: null,
    restrictions: [],
    mealType: [],
  });
  
  const { generateRecommendations, loading: aiLoading, error: aiError } = useTaranaEatsAI();
  const { toast } = useToast();

  useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(aiLoading);
    }
  }, [aiLoading, onLoadingChange]);

  useEffect(() => {
    if (initialValues) {
      setFormValues(initialValues);
    }
  }, [initialValues]);

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

    // Validate form inputs
    if (!formValues.budget || !formValues.pax) {
      toast({
        title: "Missing Information",
        description: "Please provide your budget and number of people",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Call the AI-powered recommendations service
      const recommendations = await generateRecommendations(formValues);
      
      // Pass the AI-generated recommendations to the parent component
      if (recommendations) {
        onGenerate({ matches: recommendations });
      } else if (aiError) {
        console.error("AI recommendation error:", aiError);
        // If AI failed, show error toast and use fallback
        toast({
          title: "Using Sample Data",
          description: "We couldn't generate AI recommendations. Using sample data instead.",
          variant: "destructive",
        });
        // Pass the form values directly to be handled by the fallback logic
        onGenerate(formValues);
      }
    } catch (err) {
      console.error("Failed to generate recommendations:", err);
      // If an exception occurs, show error toast and use fallback
      toast({
        title: "Error",
        description: "An unexpected error occurred. Using sample data instead.",
        variant: "destructive",
      });
      // Pass the form values to fallback logic
      onGenerate(formValues);
    }
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
              value={formValues.budget}
              onChange={(e) => updateFormValue("budget", e.target.value)}
              className="w-full rounded-xl"
              disabled={isGenerated}
            />
          </div>
          <div>
            <select 
              value={formValues.cuisine} 
              onChange={e => updateFormValue("cuisine", e.target.value)} 
              className="w-full border rounded-xl px-3 py-2 h-10"
              disabled={isGenerated}
            >
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
              onClick={() => updateFormValue("pax", opt.value)}
              disabled={isGenerated}
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
        <label className="block text-sm font-medium mb-1">Dietary Restrictions (Optional)</label>
        <div className="flex gap-2 lg:mr-48">
          {dietaryOptions.map((opt) => (
            <Button
              key={opt.label}
              type="button"
              variant="outline"
              onClick={() => toggleArrayValue("restrictions", opt.label)}
              disabled={isGenerated}
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
              disabled={isGenerated}
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
        disabled={isLoading || aiLoading || isGenerated}
        className="w-full font-semibold rounded-xl py-3 text-lg flex items-center justify-center gap-2 transition bg-gradient-to-b from-blue-700 to-blue-500 hover:from-blue-700 hover:to-purple-500 text-white"
      >
        {aiLoading || isLoading ? (
          <>
            <span className="animate-pulse">Finding AI-Powered Meal Suggestions...</span>
            <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
          </>
        ) : (
          <>
            View AI-Powered Meal Suggestions
            <span className="ml-2">→</span>
          </>
        )}
      </Button>
    </form>
  );
} 