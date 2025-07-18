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

// Hill Station Restaurant Data
const hillStationMenu: FullMenu = {
  Breakfast: [
    {
      name: "Beef Pares Breakfast Set",
      description: "Tender beef stew with garlic rice and egg.",
      price: 180,
      image: "/images/bencab.png",
    },
    {
      name: "Continental Breakfast",
      description: "Toast, eggs, bacon, and fresh fruits.",
      price: 220,
      image: "/images/hillstation.png",
    },
    {
      name: "Longsilog",
      description: "Sweet Filipino sausage with garlic rice and egg.",
      price: 160,
      image: "/images/burnham.png",
    }
  ],
  Lunch: [
    {
      name: "Cordilleran Rice Bowl",
      description: "Mixed grains with local vegetables and chicken.",
      price: 230,
      image: "/images/goodtaste.png",
    },
    {
      name: "Pinikpikan Bowl",
      description: "Traditional Cordilleran chicken soup with rice.",
      price: 180,
      image: "/images/goodtaste.png",
    },
    {
      name: "Adobo Rice Plate",
      description: "Classic pork adobo with garlic rice and pickled papaya.",
      price: 210,
      image: "/images/hillstation.png",
    }
  ],
  Dinner: [
    {
      name: "Beef Bulalo",
      description: "Hearty beef soup with bone marrow and vegetables.",
      price: 350,
      image: "/images/hillstation.png",
    },
    {
      name: "Crispy Pata",
      description: "Deep-fried pork leg with dipping sauce.",
      price: 450,
      image: "/images/bencab.png",
    },
    {
      name: "Grilled Tilapia",
      description: "Fresh tilapia with calamansi and soy sauce.",
      price: 280,
      image: "/images/hillstation.png",
    }
  ],
  Snacks: [
    {
      name: "Camote Fries",
      description: "Sweet potato fries with aioli dip.",
      price: 120,
      image: "/images/caferuins.png",
    },
    {
      name: "Turon",
      description: "Sweet banana spring rolls with caramel drizzle.",
      price: 90,
      image: "/images/caferuins.png",
    }
  ],
  Drinks: [
    {
      name: "Kapeng Barako",
      description: "Strong local coffee blend.",
      price: 55,
      image: "/images/caferuins.png",
    },
    {
      name: "Mountain Tea",
      description: "Locally sourced herbal tea.",
      price: 65,
      image: "/images/hillstation.png",
    },
    {
      name: "Baguio Berry Shake",
      description: "Fresh strawberry shake with cream.",
      price: 120,
      image: "/images/hillstation.png",
    }
  ]
};

// Itaewon Cafe Data
const itaewonCafeMenu: FullMenu = {
  Breakfast: [
    {
      name: "Korean Breakfast Set",
      description: "Rice, kimchi, grilled fish and soup.",
      price: 220,
      image: "/images/itaewon.png",
    },
    {
      name: "Juk (Rice Porridge)",
      description: "Creamy rice porridge with various toppings.",
      price: 180,
      image: "/images/itaewon.png",
    }
  ],
  Lunch: [
    {
      name: "Bibimbap",
      description: "Korean mixed rice with vegetables and meat.",
      price: 200,
      image: "/images/itaewon.png",
    },
    {
      name: "Bulgogi Rice",
      description: "Marinated beef with steamed rice.",
      price: 250,
      image: "/images/itaewon.png",
    },
    {
      name: "Japchae",
      description: "Sweet potato noodles with stir-fried vegetables.",
      price: 180,
      image: "/images/itaewon.png",
    }
  ],
  Dinner: [
    {
      name: "Korean BBQ Set",
      description: "Assorted meats for grilling with side dishes.",
      price: 650,
      image: "/images/itaewon.png",
    },
    {
      name: "Kimchi Jjigae",
      description: "Spicy kimchi stew with pork and tofu.",
      price: 280,
      image: "/images/itaewon.png",
    },
    {
      name: "Sundubu Jjigae",
      description: "Soft tofu stew with seafood or meat.",
      price: 260,
      image: "/images/itaewon.png",
    }
  ],
  Snacks: [
    {
      name: "Tteokbokki",
      description: "Spicy Korean rice cakes.",
      price: 120,
      image: "/images/itaewon.png",
    },
    {
      name: "Kimbap",
      description: "Korean seaweed rice rolls.",
      price: 150,
      image: "/images/itaewon.png",
    },
    {
      name: "Fried Mandu",
      description: "Korean dumplings with dipping sauce.",
      price: 160,
      image: "/images/itaewon.png",
    }
  ],
  Drinks: [
    {
      name: "Soju",
      description: "Korean alcoholic beverage.",
      price: 180,
      image: "/images/itaewon.png",
    },
    {
      name: "Yuzu Iced Tea",
      description: "Refreshing citrus tea.",
      price: 95,
      image: "/images/itaewon.png",
    },
    {
      name: "Sikhye",
      description: "Traditional sweet rice drink.",
      price: 85,
      image: "/images/itaewon.png",
    }
  ]
};

// Cafe Ysap Data
const cafeYsapMenu: FullMenu = {
  Breakfast: [
    {
      name: "Ysap Special",
      description: "House specialty coffee with local beans and breakfast sandwich.",
      price: 150,
      image: "/images/caferuins.png",
    },
    {
      name: "Breakfast Set",
      description: "Eggs, bread, and coffee.",
      price: 200,
      image: "/images/caferuins.png",
    },
    {
      name: "Pancake Stack",
      description: "Fluffy pancakes with maple syrup and fruit.",
      price: 180,
      image: "/images/caferuins.png",
    }
  ],
  Lunch: [
    {
      name: "Pasta Lunch",
      description: "Choice of pasta with garlic bread.",
      price: 230,
      image: "/images/caferuins.png",
    },
    {
      name: "Club Sandwich",
      description: "Triple-decker sandwich with fries.",
      price: 210,
      image: "/images/caferuins.png",
    },
    {
      name: "Caesar Salad",
      description: "Fresh romaine lettuce with homemade dressing.",
      price: 180,
      image: "/images/caferuins.png",
    }
  ],
  Dinner: [
    {
      name: "Dinner Plate",
      description: "Main dish with rice and side salad.",
      price: 280,
      image: "/images/caferuins.png",
    },
    {
      name: "Grilled Chicken",
      description: "Herb-marinated chicken with roasted vegetables.",
      price: 250,
      image: "/images/caferuins.png",
    },
    {
      name: "Pork Chop",
      description: "Juicy pork chop with mashed potatoes.",
      price: 270,
      image: "/images/caferuins.png",
    }
  ],
  Snacks: [
    {
      name: "Pastry Basket",
      description: "Assorted freshly baked pastries.",
      price: 180,
      image: "/images/caferuins.png",
    },
    {
      name: "Cheese Board",
      description: "Selection of cheeses with crackers.",
      price: 250,
      image: "/images/caferuins.png",
    },
    {
      name: "Bruschetta",
      description: "Toasted bread with tomato, basil, and olive oil.",
      price: 160,
      image: "/images/caferuins.png",
    }
  ],
  Drinks: [
    {
      name: "Specialty Coffee",
      description: "Single-origin coffee brewed to perfection.",
      price: 120,
      image: "/images/caferuins.png",
    },
    {
      name: "Fruit Smoothie",
      description: "Blended fresh fruits with yogurt.",
      price: 150,
      image: "/images/caferuins.png",
    },
    {
      name: "Hot Chocolate",
      description: "Rich chocolate drink with whipped cream.",
      price: 110,
      image: "/images/caferuins.png",
    }
  ]
};

// Golden Wok Cafe Data
const goldenWokMenu: FullMenu = {
  Breakfast: [
    {
      name: "Congee",
      description: "Rice porridge with choice of toppings.",
      price: 120,
      image: "/images/goodtaste.png",
    },
    {
      name: "Dim Sum Breakfast",
      description: "Assorted steamed dumplings and buns.",
      price: 150,
      image: "/images/goodtaste.png",
    }
  ],
  Lunch: [
    {
      name: "Yang Chow Fried Rice",
      description: "Classic Chinese fried rice with vegetables and meat.",
      price: 120,
      image: "/images/goodtaste.png",
    },
    {
      name: "Lunch Set",
      description: "One main dish with rice and soup.",
      price: 180,
      image: "/images/goodtaste.png",
    },
    {
      name: "Noodle Bowl",
      description: "Egg noodles with choice of meat and vegetables.",
      price: 160,
      image: "/images/goodtaste.png",
    }
  ],
  Dinner: [
    {
      name: "Beef with Broccoli",
      description: "Tender beef slices with fresh broccoli.",
      price: 180,
      image: "/images/goodtaste.png",
    },
    {
      name: "Sweet and Sour Pork",
      description: "Crispy pork with tangy sauce.",
      price: 190,
      image: "/images/goodtaste.png",
    },
    {
      name: "Kung Pao Chicken",
      description: "Spicy stir-fried chicken with peanuts.",
      price: 200,
      image: "/images/goodtaste.png",
    }
  ],
  Snacks: [
    {
      name: "Spring Rolls",
      description: "Vegetable or meat-filled crispy rolls.",
      price: 100,
      image: "/images/goodtaste.png",
    },
    {
      name: "Dumplings",
      description: "Steamed or fried dumplings with dipping sauce.",
      price: 120,
      image: "/images/goodtaste.png",
    },
    {
      name: "Sesame Balls",
      description: "Sweet rice flour balls with red bean filling.",
      price: 90,
      image: "/images/goodtaste.png",
    }
  ],
  Drinks: [
    {
      name: "Chinese Tea",
      description: "Traditional hot tea.",
      price: 40,
      image: "/images/goodtaste.png",
    },
    {
      name: "Lychee Juice",
      description: "Sweet lychee-flavored drink.",
      price: 80,
      image: "/images/goodtaste.png",
    },
    {
      name: "Almond Milk",
      description: "Sweetened almond milk drink.",
      price: 90,
      image: "/images/goodtaste.png",
    }
  ]
};

// Sakura Sip & Snack Data
const sakuraMenu: FullMenu = {
  Breakfast: [
    {
      name: "Japanese Breakfast",
      description: "Grilled fish, rice, miso soup, and pickles.",
      price: 200,
      image: "/images/letai.png",
    },
    {
      name: "Tamago Kake Gohan",
      description: "Rice with raw egg and soy sauce.",
      price: 150,
      image: "/images/letai.png",
    }
  ],
  Lunch: [
    {
      name: "Bento Box",
      description: "Rice, protein, vegetables, and side dishes.",
      price: 250,
      image: "/images/letai.png",
    },
    {
      name: "Curry Rice",
      description: "Japanese curry with rice and protein.",
      price: 220,
      image: "/images/letai.png",
    },
    {
      name: "Onigiri Set",
      description: "Rice balls with various fillings and miso soup.",
      price: 180,
      image: "/images/letai.png",
    }
  ],
  Dinner: [
    {
      name: "Ramen",
      description: "Noodle soup with toppings.",
      price: 220,
      image: "/images/letai.png",
    },
    {
      name: "Sushi Platter",
      description: "Assorted sushi rolls and nigiri.",
      price: 350,
      image: "/images/letai.png",
    },
    {
      name: "Donburi",
      description: "Rice bowl topped with meat or fish.",
      price: 250,
      image: "/images/letai.png",
    }
  ],
  Snacks: [
    {
      name: "Matcha Latte",
      description: "Premium matcha with milk.",
      price: 120,
      image: "/images/letai.png",
    },
    {
      name: "Dorayaki",
      description: "Japanese pancake filled with sweet red bean paste.",
      price: 80,
      image: "/images/letai.png",
    },
    {
      name: "Taiyaki",
      description: "Fish-shaped cake with various fillings.",
      price: 90,
      image: "/images/letai.png",
    }
  ],
  Drinks: [
    {
      name: "Sakura Tea",
      description: "Cherry blossom flavored tea.",
      price: 90,
      image: "/images/letai.png",
    },
    {
      name: "Melon Soda",
      description: "Sweet Japanese melon-flavored soda.",
      price: 110,
      image: "/images/letai.png",
    },
    {
      name: "Ramune",
      description: "Traditional Japanese marble soda.",
      price: 100,
      image: "/images/letai.png",
    }
  ]
};

// Legacy menu data for compatibility
const MENU_DATA: Record<string, MenuItem[]> = {
  "Hill Station": hillStationMenu.Breakfast.concat(hillStationMenu.Lunch, hillStationMenu.Dinner).slice(0, 3),
  "Itaewon Cafe": itaewonCafeMenu.Lunch.concat(itaewonCafeMenu.Dinner).slice(0, 2),
};

// ====================================================================
// COMPLETE RESTAURANT DATA
// ====================================================================

// Master restaurant data array with all details
export const restaurants: RestaurantData[] = [
  {
    name: "Hill Station",
    cuisine: ["Filipino", "Ilocano/Cordilleran"],
    priceRange: {
      min: 150,
      max: 450
    },
    location: "Session Road, Baguio City",
    popularFor: ["Breakfast", "Lunch", "Dinner"],
    menuItems: MENU_DATA["Hill Station"],
    fullMenu: hillStationMenu,
    image: "/images/hillstation.png",
    tags: ["Family-Friendly", "Local Cuisine"],
    ratings: 4.5,
    dietaryOptions: ["Vegetarian"]
  },
  {
    name: "Itaewon Cafe",
    cuisine: ["Korean"],
    priceRange: {
      min: 120,
      max: 650
    },
    location: "Upper Session Road, Baguio City",
    popularFor: ["Lunch", "Dinner"],
    menuItems: MENU_DATA["Itaewon Cafe"],
    fullMenu: itaewonCafeMenu,
    image: "/images/itaewon.png",
    tags: ["Trendy", "International"],
    ratings: 4.2,
    dietaryOptions: ["Halal"]
  },
  {
    name: "Cafe Ysap",
    cuisine: ["Filipino", "Ilocano/Cordilleran", "International"],
    priceRange: {
      min: 100,
      max: 300
    },
    location: "Loakan, Baguio City",
    popularFor: ["Breakfast", "Snacks"],
    menuItems: cafeYsapMenu.Breakfast.slice(0, 2),
    fullMenu: cafeYsapMenu,
    image: "/images/caferuins.png",
    tags: ["Cozy", "Local Cuisine"],
    ratings: 4.3,
    dietaryOptions: ["Vegetarian"]
  },
  {
    name: "Golden Wok Cafe",
    cuisine: ["Chinese"],
    priceRange: {
      min: 90,
      max: 200
    },
    location: "Upper QM, near Lourdes Grotto, Baguio City",
    popularFor: ["Dinner"],
    menuItems: [goldenWokMenu.Lunch[0], goldenWokMenu.Dinner[0]],
    fullMenu: goldenWokMenu,
    image: "/images/goodtaste.png",
    tags: ["Family-Friendly", "Group-Friendly"],
    ratings: 4.0,
    dietaryOptions: []
  },
  {
    name: "Sakura Sip & Snack",
    cuisine: ["Japanese"],
    priceRange: {
      min: 80,
      max: 350
    },
    location: "Military Cut-off Road, Baguio City",
    popularFor: ["Snacks", "Drinks"],
    menuItems: [sakuraMenu.Snacks[0], sakuraMenu.Snacks[1]],
    fullMenu: sakuraMenu,
    image: "/images/letai.png",
    tags: ["Cozy", "International"],
    ratings: 4.1,
    dietaryOptions: ["Vegetarian", "Vegan"]
  }
];

// Export all menus in a single object for easy access
export const allRestaurantMenus: Record<string, FullMenu> = {
  "Hill Station": hillStationMenu,
  "Itaewon Cafe": itaewonCafeMenu,
  "Cafe Ysap": cafeYsapMenu,
  "Golden Wok Cafe": goldenWokMenu,
  "Sakura Sip & Snack": sakuraMenu
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