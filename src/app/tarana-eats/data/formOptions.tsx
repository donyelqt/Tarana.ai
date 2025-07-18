import React from "react";
import { Leaf, Vegan, BadgeCheck, Coffee, Soup, Moon, Cookie } from "lucide-react";

export const cuisineOptions = [
  "Filipino",
  "Ilocano/Cordilleran",
  "Korean",
  "Chinese",
  "Japanese",
  "Thai",
  "Middle Eastern",
  "Show All",
];

export const paxOptions = [
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3-5", value: 4 },
  { label: "6+", value: 6 },
];

export interface OptionWithIcon {
  label: string;
  icon: React.ReactNode;
}

export const dietaryOptions: OptionWithIcon[] = [
  { label: "Vegetarian", icon: <Leaf className="w-4 h-4" /> },
  { label: "Halal", icon: <BadgeCheck className="w-4 h-4" /> },
  { label: "Vegan", icon: <Vegan className="w-4 h-4" /> },
];

export const mealTypeOptions: OptionWithIcon[] = [
  { label: "Breakfast", icon: <Coffee className="w-4 h-4" /> },
  { label: "Lunch", icon: <Soup className="w-4 h-4" /> },
  { label: "Dinner", icon: <Moon className="w-4 h-4" /> },
  { label: "Snack", icon: <Cookie className="w-4 h-4" /> },
]; 