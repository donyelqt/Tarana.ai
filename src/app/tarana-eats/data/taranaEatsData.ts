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
  menuItems: MenuItem[];
  fullMenu: FullMenu;
  image: string;
  tags: string[];
  ratings?: number;
  dietaryOptions: string[];
  about?: string;
  hours?: string;
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

// Myeong Dong Jjigae Restaurant Menu Data
const myeongDongJjigaeMenu: FullMenu = {
  Breakfast: [],
  Lunch: [
    {
      name: "Myeongdong Set A",
      description: "Buffet Only",
      price: 399,
      image: "https://www.facebook.com/photo.php?fbid=122177289860112650&set=pb.61553379521587.-2207520000&type=3",
    },
    {
      name: "Myeongdong Set B",
      description: "Buffet with Samgyeopsal",
      price: 599,
      image: "https://www.facebook.com/photo?fbid=122177289872112650&set=pb.61553379521587.-2207520000",
    },
    {
      name: "Myeongdong Set C",
      description: "Buffet with Hotpot/Jjigae",
      price: 599,
      image: "https://www.facebook.com/photo?fbid=122177289854112650&set=pb.61553379521587.-2207520000",
    },
    {
      name: "Myeongdong Set D",
      description: "All-in-Buffet with Samgyeopsal and Jjigae",
      price: 699,
      image: "https://www.facebook.com/photo?fbid=122177289866112650&set=pb.61553379521587.-2207520000",
    },
  ],
  Dinner: [],
  Snacks: [],
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

// Uji-Matcha Cafe Menu Data
const ujiMatchaCafeMenu: FullMenu = {
  Breakfast: [],
  Lunch: [],
  Dinner: [],
  Snacks: [],
  Drinks: [
    {
      name: "Pure Uji-Matcha",
      description: "Matcha + Water + Sweetener",
      price: 110,
      image: "https://images.deliveryhero.io/image/fd-ph/Products/39974537.jpg??width=800",
    },
    {
      name: "Matcha Latte",
      description: "Matcha + Milk + Sweetener",
      price: 155,
      image: "https://images.deliveryhero.io/image/fd-ph/Products/39974542.jpg??width=800",
    },
    {
      name: "Spanish Matcha Latte",
      description: "Matcha + Milk + Condense Milk",
      price: 155,
      image: "https://images.deliveryhero.io/image/fd-ph/Products/39974543.jpg??width=800",
    },
    {
      name: "Honey Matcha Latte",
      description: "Matcha + Milk + Wildflower Honey",
      price: 160,
      image: "https://images.deliveryhero.io/image/fd-ph/Products/53768974.jpg??width=800",
    },
    {
      name: "Dirty Matcha Latte",
      description: "Matcha + Milk + Biscoff",
      price: 165,
      image: "https://images.deliveryhero.io/image/fd-ph/Products/39974552.jpg??width=800",
    },
    {
      name: "Strawberry Matcha Latte (Iced Only)",
      description: "Matcha + Milk + Strawberry",
      price: 155,
      image: "https://images.deliveryhero.io/image/fd-ph/Products/39974553.jpg??width=800",
    },
    {
      name: "Blueberry Matcha Latte (Iced Only)",
      description: "Matcha + Milk + Blueberry",
      price: 155,
      image: "https://images.deliveryhero.io/image/fd-ph/Products/39974554.jpg??width=800",
    },
    {
      name: "Sweet Black (Espresso Based)",
      description: "2 shots Espresso + Water + Sweetener",
      price: 100,
      image: "https://images.deliveryhero.io/image/fd-ph/Products/39974574.jpg??width=800",
    },
    {
      name: "Spanish Latte (Espresso Based)",
      description: "1 or 2 shots Espresso + Milk + Condense Milk",
      price: 140,
      image: "https://images.deliveryhero.io/image/fd-ph/Products/39974577.jpg??width=800",
    },
    {
      name: "Mocha Latte (Espresso Based)",
      description: "1 shot Espresso + Milk + Salted Caramel",
      price: 140,
      image: "https://images.deliveryhero.io/image/fd-ph/Products/39974579.jpg??width=800",
    },
    {
      name: "Strawberry Milk (Non-Matcha)",
      description: "Fresh milk infused with the natural sweetness of strawberries, delivers a fruity and refreshing flavor",
      price: 125,
      image: "https://images.deliveryhero.io/image/fd-ph/Products/39974581.jpg??width=800",
    },
    {
      name: "Houjicha Latte",
      description: "Houjicha + Milk + Sweetener",
      price: 160,
      image: "https://images.deliveryhero.io/image/fd-ph/Products/64742086.jpg??width=800",
    }
  ]
};

  // K-Flavors Buffet Menu Data
  const kFlavorsBuffetMenu: FullMenu = {
    Breakfast: [
      {
        name: "Buffet (M-TH, No beef/cheese/ice cream)",
        description: "NO beef, cheese, ice cream",
        price: 399,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (M-TH, With beef/cheese/ice cream)",
        description: "with beef, cheese, 1 scoop of ice cream",
        price: 450,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (M-TH, With beef/cheese/ice cream/unli iced tea)",
        description: "with beef, cheese, 1 scoop of ice cream, unli iced tea",
        price: 470,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (F-S, No beef/cheese/ice cream)",
        description: "NO beef, cheese, ice cream",
        price: 450,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (F-S, With beef/cheese/ice cream)",
        description: "with beef, cheese, 1 scoop of ice cream",
        price: 470,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (F-S, With beef/cheese/ice cream/unli iced tea)",
        description: "with beef, cheese, 1 scoop of ice cream, unli iced tea",
        price: 499,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      }
    ],
    Lunch: [
      {
        name: "Buffet (M-TH, No beef/cheese/ice cream)",
        description: "NO beef, cheese, ice cream",
        price: 399,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (M-TH, With beef/cheese/ice cream)",
        description: "with beef, cheese, 1 scoop of ice cream",
        price: 450,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (M-TH, With beef/cheese/ice cream/unli iced tea)",
        description: "with beef, cheese, 1 scoop of ice cream, unli iced tea",
        price: 470,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (F-S, No beef/cheese/ice cream)",
        description: "NO beef, cheese, ice cream",
        price: 450,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (F-S, With beef/cheese/ice cream)",
        description: "with beef, cheese, 1 scoop of ice cream",
        price: 470,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (F-S, With beef/cheese/ice cream/unli iced tea)",
        description: "with beef, cheese, 1 scoop of ice cream, unli iced tea",
        price: 499,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      }
    ],
    Dinner: [
      {
        name: "Buffet (M-TH, No beef/cheese/ice cream)",
        description: "NO beef, cheese, ice cream",
        price: 399,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (M-TH, With beef/cheese/ice cream)",
        description: "with beef, cheese, 1 scoop of ice cream",
        price: 450,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (M-TH, With beef/cheese/ice cream/unli iced tea)",
        description: "with beef, cheese, 1 scoop of ice cream, unli iced tea",
        price: 470,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (F-S, No beef/cheese/ice cream)",
        description: "NO beef, cheese, ice cream",
        price: 450,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (F-S, With beef/cheese/ice cream)",
        description: "with beef, cheese, 1 scoop of ice cream",
        price: 470,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (F-S, With beef/cheese/ice cream/unli iced tea)",
        description: "with beef, cheese, 1 scoop of ice cream, unli iced tea",
        price: 499,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      }
    ],
    Snacks: [],
    Drinks: [
      {
        name: "Buffet (M-TH, No beef/cheese/ice cream)",
        description: "NO beef, cheese, ice cream",
        price: 399,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (M-TH, With beef/cheese/ice cream)",
        description: "with beef, cheese, 1 scoop of ice cream",
        price: 450,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (M-TH, With beef/cheese/ice cream/unli iced tea)",
        description: "with beef, cheese, 1 scoop of ice cream, unli iced tea",
        price: 470,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (F-S, No beef/cheese/ice cream)",
        description: "NO beef, cheese, ice cream",
        price: 450,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (F-S, With beef/cheese/ice cream)",
        description: "with beef, cheese, 1 scoop of ice cream",
        price: 470,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      },
      {
        name: "Buffet (F-S, With beef/cheese/ice cream/unli iced tea)",
        description: "with beef, cheese, 1 scoop of ice cream, unli iced tea",
        price: 499,
        image: "https://www.facebook.com/photo.php?fbid=660691786987731&set=pb.100091407458861.-2207520000&type=3",
      }
    ]
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
    about: "A cozy cafe beside Baguio Cathedral serving locally sourced coffee and snacks.",
    hours: "8:00 AM - 6:00 PM",
  },
  {
    name: "Oh My Gulay",
    cuisine: ["Filipino", "Vegetarian"],
    priceRange: {
      min: 200,
      max: 225,
    },
    location: "La Azotea Building, Session Road",
    popularFor: ["Vegetarian", "Artistic Ambiance"],
    menuItems: [],
    fullMenu: ohMyGulayMenu,
    image: "/images/ohmygulay.jpg",
    tags: ["Vegetarian", "Filipino", "Baguio"],
    dietaryOptions: ["Vegetarian"],
    about: "A vegetarian restaurant and art space with creative Filipino dishes and a unique atmosphere.",
    hours: "11:00 AM - 9:00 PM",
  },
  {
    name: "Uji-Matcha Cafe",
    cuisine: ["Cafe", "Japanese", "Tea"],
    priceRange: {
      min: 100,
      max: 165,
    },
    location: "Porta Vaga Mall, Session Road",
    popularFor: ["Matcha", "Japanese Drinks"],
    menuItems: [],
    fullMenu: ujiMatchaCafeMenu,
    image: "/images/ujimatcha.png",
    tags: ["Cafe", "Matcha", "Japanese", "Baguio"],
    dietaryOptions: [],
    about: "A specialty cafe offering authentic Japanese matcha drinks and desserts.",
    hours: "10:00 AM - 8:00 PM",
  },
  {
    name: "K-Flavors Buffet",
    cuisine: ["Korean", "Buffet"],
    priceRange: {
      min: 399,
      max: 499,
    },
    location: "Upper Session Road",
    popularFor: ["Buffet", "Korean BBQ"],
    menuItems: [],
    fullMenu: kFlavorsBuffetMenu,
    image: "/images/kflavors.png",
    tags: ["Korean", "Buffet", "Baguio"],
    dietaryOptions: [],
    about: "A popular Korean buffet spot with a wide selection of meats and side dishes.",
    hours: "11:00 AM - 10:00 PM",
  },
];

// Create a record of all restaurant menus for easy lookup
export const allRestaurantMenus: Record<string, FullMenu> = {
  "Good Sheperd Cafe": goodSheperdCafeMenu,
  "Oh My Gulay": ohMyGulayMenu,
  "Uji-Matcha Cafe": ujiMatchaCafeMenu,
  "K-Flavors Buffet": kFlavorsBuffetMenu,
  "Myeong Dong Jjigae Restaurant": myeongDongJjigaeMenu,
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