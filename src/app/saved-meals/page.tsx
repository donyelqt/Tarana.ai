
"use client";

import { useSession } from 'next-auth/react'
import { getSavedMeals } from '@/lib/data/supabaseMeals';
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Plus, Search, Utensils } from 'lucide-react';
import { savedMeals as initialSavedMeals, SavedMeal } from "./data";
import MealCard from "./components/MealCard";
import { useRouter } from 'next/navigation';

const SavedMealsPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  // React Query - Cached meals list
  const { data: savedMeals = [], isLoading } = useQuery({
    queryKey: ['saved-meals', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      return await getSavedMeals(session.user.id);
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Filtered meals based on search (memoized for performance)
  const filteredMeals = useMemo(() => {
    if (searchQuery.trim() === "") {
      return savedMeals;
    }
    return savedMeals.filter((meal) =>
      meal.cafeName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [savedMeals, searchQuery]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  }

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
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-xl flex items-center shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5"
              onClick={handleGenerateMeals}
            >
              <Plus size={20} className="mr-2" />
              Generate
            </Button>
          </div>

          {/* Filters */}
          <div className="mb-8 p-6 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-200/60 transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)]">
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

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="overflow-hidden rounded-3xl border border-gray-200/60 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] animate-pulse">
                  <div className="h-48 w-full bg-gray-200"></div>
                  <div className="p-5">
                    <div className="h-6 w-3/4 bg-gray-300 rounded mb-3"></div>
                    <div className="h-4 w-1/2 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 w-2/3 bg-gray-200 rounded mb-4"></div>
                    <div className="flex justify-between items-center">
                      <div className="h-6 w-20 bg-gray-300 rounded"></div>
                      <div className="h-8 w-24 bg-gray-200 rounded-lg"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Meals Grid */}
          {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMeals.map((meal) => (
                <MealCard key={meal.id} meal={meal} />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredMeals.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                <Utensils className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No meals found' : 'No saved meals yet'}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchQuery
                  ? 'Try adjusting your search query'
                  : 'Start by generating meal recommendations'}
              </p>
              {!searchQuery && (
                <Button
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-300 hover:-translate-y-0.5"
                  onClick={handleGenerateMeals}
                >
                  <Plus size={20} className="mr-2" />
                  Generate Meals
                </Button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SavedMealsPage;