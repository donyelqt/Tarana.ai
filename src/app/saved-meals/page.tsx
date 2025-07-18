
"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { savedMeals as initialSavedMeals, SavedMeal } from "./data";
import MealCard from "./components/MealCard";
import { useRouter } from "next/navigation";

const SavedMealsPage = () => {
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>(initialSavedMeals);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Load saved meals from localStorage when the component mounts
    // Only run on client side
    if (typeof window !== 'undefined') {
      try {
        const storedMeals = localStorage.getItem('savedMeals');
        if (storedMeals) {
          const parsedStoredMeals: SavedMeal[] = JSON.parse(storedMeals);
          // Combine with initial static data
          setSavedMeals([...initialSavedMeals, ...parsedStoredMeals]);
        }
      } catch (error) {
        console.error("Error loading saved meals:", error);
      }
    }
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === "") {
      // Get stored meals again to ensure we have the latest
      try {
        if (typeof window !== 'undefined') {
          const storedMeals = localStorage.getItem('savedMeals');
          if (storedMeals) {
            const parsedStoredMeals: SavedMeal[] = JSON.parse(storedMeals);
            setSavedMeals([...initialSavedMeals, ...parsedStoredMeals]);
          } else {
            setSavedMeals(initialSavedMeals);
          }
        } else {
          setSavedMeals(initialSavedMeals);
        }
      } catch (error) {
        console.error("Error loading saved meals:", error);
        setSavedMeals(initialSavedMeals);
      }
    } else {
      // Get all meals including stored ones
      let allMeals = [...initialSavedMeals];
      try {
        if (typeof window !== 'undefined') {
          const storedMeals = localStorage.getItem('savedMeals');
          if (storedMeals) {
            const parsedStoredMeals: SavedMeal[] = JSON.parse(storedMeals);
            allMeals = [...allMeals, ...parsedStoredMeals];
          }
        }
      } catch (error) {
        console.error("Error loading saved meals for search:", error);
      }

      // Filter based on search query
      const filtered = allMeals.filter(
        (meal) =>
          meal.cafeName.toLowerCase().includes(query.toLowerCase())
      );
      setSavedMeals(filtered);
    }
  };

  const handleGenerateMeals = () => {
    router.push("/tarana-eats");
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      <Sidebar />
      <main className="md:pl-64 flex-1">
        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Saved Meals</h1>
              <p className="text-gray-500 mt-1">
                All your saved meal recommendations in one place.
              </p>
            </div>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center"
              onClick={handleGenerateMeals}
            >
              <Plus size={20} className="mr-2" />
              Generate
            </Button>
          </div>

          {/* Filters */}
          <div className="mb-8 p-4 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by cafe name or dish"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="All Meal Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Budget Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100-300">₱100-300</SelectItem>
                  <SelectItem value="300-500">₱300-500</SelectItem>
                  <SelectItem value="500+">₱500+</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Cuisine Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="filipino">Filipino</SelectItem>
                  <SelectItem value="chinese">Chinese</SelectItem>
                  <SelectItem value="japanese">Japanese</SelectItem>
                  <SelectItem value="western">Western</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Meals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {savedMeals.map((meal) => (
              <MealCard key={meal.id} meal={meal} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SavedMealsPage; 