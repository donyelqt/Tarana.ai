// ====================================================================
// TARANA EATS DATA STRUCTURE
// ====================================================================
//
// This file combines restaurant data and menu information in a structured,
// scalable format for the Tarana Eats feature. 
//
// ORGANIZATION:
//   1. Type Definitions - Define data structures
//   2. Helper Functions - Utils to work with the data
//   3. Restaurant & Menu Data - Individual restaurant menus by category
//   4. Complete Restaurant Data - Master restaurant array with all details
//   5. Saved Meals & AI Data - Data preparation for AI recommendations
//
// HOW TO ADD A NEW RESTAURANT:
// 1. Create a new menu object following the existing format:
//    const newRestaurantMenu: FullMenu = { Breakfast: [...], Lunch: [...], ... }
// 
// 2. Add an entry to the restaurants array with all the restaurant details
//
// 3. Add the restaurant to the allRestaurantMenus record
//
// ACCESSING DATA:
// - Access a restaurant's full menu: allRestaurantMenus["Restaurant Name"]
// - Get a specific category: allRestaurantMenus["Restaurant Name"].Breakfast
// - Use the helper: getMenuByRestaurantName("Restaurant Name")
//
// For testing menu data, run: 
// http://localhost:3000/tarana-eats/test-menu-data
// ====================================================================

import { MenuItem, ResultMatch } from "@/types/tarana-eats";
import { SavedMeal } from "@/app/saved-meals/data";
import { savedMeals } from "@/app/saved-meals/data";
import { 
  cuisineOptions, 
  paxOptions, 
  dietaryOptions, 
  mealTypeOptions,
  OptionWithIcon 
} from "./formOptions";

// ====================================================================
// TYPE DEFINITIONS
// ====================================================================

// Define the structure for categorized menu items
export interface FullMenu {
  Breakfast: MenuItem[];
  Lunch: MenuItem[];
  Dinner: MenuItem[];
  Snacks: MenuItem[];
  Drinks: MenuItem[];
}

// Extended MenuItem type with category
export interface MenuItemWithCategory extends MenuItem {
  category: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks' | 'Drinks';
}

// Full restaurant data with all details
export interface RestaurantData {
  name: string;
  cuisine: string[];
  priceRange: {
    min: number;
    max: number;
  };
  location: string;
  popularFor: string[];
  menuItems: MenuItem[];  // Legacy format
  fullMenu: FullMenu;     // Organized by category
  image: string;
  tags: string[];
  ratings?: number;
  dietaryOptions: string[];
}

// ====================================================================
// HELPER FUNCTIONS
// ====================================================================

// Create an empty menu structure for consistency
export const getEmptyFullMenu = (): FullMenu => ({
  Breakfast: [],
  Lunch: [],
  Dinner: [],
  Snacks: [],
  Drinks: []
});

// Helper function to get a restaurant's menu by name
export const getMenuByRestaurantName = (name: string): FullMenu => {
  const restaurant = restaurants.find(r => r.name === name);
  return restaurant?.fullMenu || getEmptyFullMenu();
};

// Helper function to convert user preferences to an AI prompt
export const createFoodPrompt = (preferences: any) => {
  const { budget, cuisine, pax, restrictions, mealType } = preferences;
  
  // Format budget as a range
  let budgetRange = "mid-range";
  if (budget) {
    const budgetNum = parseInt(budget.replace(/[^\d]/g, ''));
    if (budgetNum < 300) budgetRange = "budget-friendly";
    else if (budgetNum > 1000) budgetRange = "high-end";
    else budgetRange = "mid-range";
  }

  // Create the prompt
  return `
    I need food recommendations in Baguio City based on these preferences:
    - Budget: ${budget || budgetRange}
    - Cuisine preference: ${cuisine || "Any"}
    - Number of people: ${pax || "1-2"}
    - Dietary restrictions: ${restrictions && restrictions.length > 0 ? restrictions.join(", ") : "None"}
    - Meal type: ${mealType && mealType.length > 0 ? mealType.join(", ") : "Any"}
    
    Use the provided restaurant database to suggest 3-5 suitable options that match these criteria.
    For each suggestion, provide:
    1. Restaurant name
    2. Why it's a good match
    3. Recommended dishes from their menu based on meal type (Breakfast, Lunch, Dinner, Snacks, or Drinks)
    4. Price range
  `;
};

// ====================================================================
// RESTAURANT & MENU DATA
// ====================================================================

// Good Sheperd Cafe Menu Data
const goodSheperdCafeMenu: FullMenu = {
  Breakfast: [],
  Lunch: [],
  Dinner: [],
  Snacks: [
    {
      name: "Long Black (Coffee)",
      description: "Our coffee is crafted from locally sourced beans handpicked from the farms in Atok, Benguet - bringing the taste of the Cordilleras to every sip.",
      price: 125,
      image: "/images/placeholders/coffee.png", // Placeholder image
    },
    {
      name: "Cafe Latte (Coffee)",
      description: "Our coffee is crafted from locally sourced beans handpicked from the farms in Atok, Benguet - bringing the taste of the Cordilleras to every sip.",
      price: 145,
      image: "/images/placeholders/coffee.png", // Placeholder image
    },
    {
      name: "Cappuccino (Coffee)",
      description: "Our coffee is crafted from locally sourced beans handpicked from the farms in Atok, Benguet - bringing the taste of the Cordilleras to every sip.",
      price: 145,
      image: "/images/placeholders/coffee.png", // Placeholder image
    },
    {
      name: "Caramel Macchiato (Coffee)",
      description: "Our coffee is crafted from locally sourced beans handpicked from the farms in Atok, Benguet - bringing the taste of the Cordilleras to every sip.",
      price: 185,
      image: "/images/placeholders/coffee.png", // Placeholder image
    },
    {
      name: "White Mocha Latte (Coffee)",
      description: "Our coffee is crafted from locally sourced beans handpicked from the farms in Atok, Benguet - bringing the taste of the Cordilleras to every sip.",
      price: 185,
      image: "/images/placeholders/coffee.png", // Placeholder image
    },
    {
      name: "Sheperd's Latte",
      description: "Our coffee is crafted from locally sourced beans handpicked from the farms in Atok, Benguet - bringing the taste of the Cordilleras to every sip.",
      price: 210,
      image: "/images/placeholders/coffee.png", // Placeholder image
    },
    {
      name: "Orange Espresso",
      description: "Our coffee is crafted from locally sourced beans handpicked from the farms in Atok, Benguet - bringing the taste of the Cordilleras to every sip.",
      price: 210,
      image: "/images/placeholders/coffee.png", // Placeholder image
    },
    {
      name: "Pineapple Hibiscus",
      description: "No description available — yet.",
      price: 160,
      image: "/images/placeholders/juice.png", // Placeholder image
    },
    {
      name: "Calamansi Juice",
      description: "No description available — yet.",
      price: 160,
      image: "/images/placeholders/juice.png", // Placeholder image
    },
  ],
  Drinks: [],
};

// Oh My Gulay Menu Data
const ohMyGulayMenu: FullMenu = {
  Breakfast: [],
  Lunch: [
    {
      name: "Bonifacio's Waldofesto",
      description: "Sliced apples, celery, potatoes, egg slices, nuts & garlic-mayo pesto",
      price: 225,
      image: "https://images.deliveryhero.io/image/fd-ph/products/5513120.jpg??width=800",
    },
    {
      name: "KKK Sliders",
      description: "Two veggie burgers & salad",
      price: 225,
      image: "https://images.deliveryhero.io/image/fd-ph/products/5513121.jpg??width=800",
    },
    {
      name: "Pancit Gulay Ni Pepe",
      description: "Egg noodles, tofu & vegetables in season",
      price: 225,
      image: "https://images.deliveryhero.io/image/fd-ph/products/5513127.jpg??width=800",
    },
    {
      name: "Walastik Bistek",
      description: "Vegemeat, tofu, potatoes, onions & quail eggs",
      price: 225,
      image: "https://images.deliveryhero.io/image/fd-ph/products/5513129.jpg??width=800",
    },
    {
      name: "Tandang Sora Parmigiana",
      description: "Breaded eggplant over whole wheat bread, special red sauce, pesto & cheese",
      price: 225,
      image: "https://images.deliveryhero.io/image/fd-ph/products/5513122.jpg??width=800",
    },
    {
      name: "CESAR ASAR",
      description: "Vegetarian Ceasar Salad with toasted garlic bread",
      price: 200,
      image: "https://images.deliveryhero.io/image/fd-ph/Products/32477040.jpg??width=800",
    },
    {
      name: "Bandilang Pula",
      description: "Mountain rice, vegetables in season, mongolian sauce, tofu, omelette",
      price: 225,
      image: "https://images.deliveryhero.io/image/fd-ph/products/5513128.jpg??width=800",
    },
    {
      name: "Anak Ng Putanesca",
      description: "No description available — yet.",
      price: 220,
      image: "https://images.deliveryhero.io/image/fd-ph/products/5513123.jpg??width=800",
    },
  ],
  Dinner: [
    {
      name: "Bonifacio's Waldofesto",
      description: "Sliced apples, celery, potatoes, egg slices, nuts & garlic-mayo pesto",
      price: 225,
      image: "https://images.deliveryhero.io/image/fd-ph/products/5513120.jpg??width=800",
    },
    {
      name: "KKK Sliders",
      description: "Two veggie burgers & salad",
      price: 225,
      image: "https://images.deliveryhero.io/image/fd-ph/products/5513121.jpg??width=800",
    },
    {
      name: "Pancit Gulay Ni Pepe",
      description: "Egg noodles, tofu & vegetables in season",
      price: 225,
      image: "https://images.deliveryhero.io/image/fd-ph/products/5513127.jpg??width=800",
    },
    {
      name: "Walastik Bistek",
      description: "Vegemeat, tofu, potatoes, onions & quail eggs",
      price: 225,
      image: "https://images.deliveryhero.io/image/fd-ph/products/5513129.jpg??width=800",
    },
    {
      name: "Tandang Sora Parmigiana",
      description: "Breaded eggplant over whole wheat bread, special red sauce, pesto & cheese",
      price: 225,
      image: "https://images.deliveryhero.io/image/fd-ph/products/5513122.jpg??width=800",
    },
    {
      name: "CESAR ASAR",
      description: "Vegetarian Ceasar Salad with toasted garlic bread",
      price: 200,
      image: "https://images.deliveryhero.io/image/fd-ph/Products/32477040.jpg??width=800",
    },
    {
      name: "Bandilang Pula",
      description: "Mountain rice, vegetables in season, mongolian sauce, tofu, omelette",
      price: 225,
      image: "https://images.deliveryhero.io/image/fd-ph/products/5513128.jpg??width=800",
    },
    {
      name: "Anak Ng Putanesca",
      description: "No description available — yet.",
      price: 220,
      image: "https://images.deliveryhero.io/image/fd-ph/products/5513123.jpg??width=800",
    },
  ],
  Snacks: [],
  Drinks: [],
};

// ====================================================================
// COMPLETE RESTAURANT DATA
// ====================================================================

export const restaurants: RestaurantData[] = [
  {
    name: "Good Sheperd Cafe",
    cuisine: ["Cafe", "Coffee"],
    priceRange: {
      min: 125,
      max: 210,
    },
    location: "Beside Baguio Cathedral",
    popularFor: ["Coffee", "Local Beans"],
    menuItems: [], // Legacy format, using fullMenu instead
    fullMenu: goodSheperdCafeMenu,
    image: "/images/caferuins.png", // Using a relevant placeholder
    tags: ["Cafe", "Coffee", "Baguio"],
    dietaryOptions: [],
  },
  {
    name: "Oh My Gulay",
    cuisine: ["Filipino", "Vegetarian"],
    priceRange: {
      min: 200,
      max: 225,
    },
    location: "Session Road",
    popularFor: ["Vegetarian Dishes", "Artistic Ambiance"],
    menuItems: [], // Legacy format, using fullMenu instead
    fullMenu: ohMyGulayMenu,
    image: "/images/placeholders/ohmygulay.png", // Placeholder image
    tags: ["Vegetarian", "Filipino", "Art Cafe", "Baguio"],
    dietaryOptions: ["Vegan", "Vegetarian"],
  },
];

// Create a record of all restaurant menus for easy lookup
export const allRestaurantMenus: Record<string, FullMenu> = {
  "Good Sheperd Cafe": goodSheperdCafeMenu,
  "Oh My Gulay": ohMyGulayMenu,
};

// ====================================================================
// SAVED MEALS & AI DATA
// ====================================================================

// Convert saved meals to additional data for AI processing
export const savedMealExperiences = savedMeals.map(meal => {
  // Find the corresponding restaurant in our data
  const restaurant = restaurants.find(r => r.name === meal.cafeName) || {
    name: meal.cafeName,
    cuisine: [],
    priceRange: { min: meal.price * 0.8, max: meal.price * 1.2 },
    location: meal.location,
    popularFor: [meal.mealType],
    menuItems: [],
    fullMenu: getEmptyFullMenu(),
    image: meal.image,
    tags: [],
    dietaryOptions: []
  };

  return {
    id: meal.id,
    restaurant: restaurant.name,
    mealType: meal.mealType,
    price: meal.price,
    goodFor: meal.goodFor,
    location: meal.location,
    image: meal.image,
    cuisine: restaurant.cuisine,
    tags: restaurant.tags,
    ratings: restaurant.ratings,
    fullMenu: restaurant.fullMenu
  };
});

// Form options for Gemini API to understand user preferences
export const formOptionsData = {
  cuisineOptions,
  paxOptions,
  dietaryOptions: dietaryOptions.map(opt => opt.label),
  mealTypeOptions: mealTypeOptions.map(opt => opt.label)
};

// Export a combined dataset for the Gemini API
export const combinedFoodData = {
  restaurants,
  savedMeals: savedMealExperiences,
  formOptions: formOptionsData
};