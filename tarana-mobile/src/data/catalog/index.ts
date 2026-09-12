/**
 * Mobile cafe index — 20 real Baguio entries, fields transcribed verbatim
 * from `src/app/tarana-eats/data/restaurants.ts` (names, cuisines, prices,
 * locations, about, hours, dietary, tags).
 *
 * Menus: 6 signature cafes carry their full dish lists, copied byte-for-byte
 * from `src/app/tarana-eats/data/menus/*.ts` into `./menus/` (only their
 * `import { FullMenu } from "../types"` resolves here to the local
 * `catalog/types.ts` — zero other imports, Metro-safe by construction).
 * The other 14 ship `EMPTY_MENU` with `hasMenu: false`; their detail
 * screens hide the menu section (no dead buttons) until the full catalog
 * arrives via a web endpoint later.
 */
import { EMPTY_MENU, menuDishCount, type Cafe, type FullMenu } from './types';
export { EMPTY_MENU, menuDishCount };
export type { Cafe, FullMenu };
import { goodShepherdCafeMenu } from './menus/goodShepherdCafe';
import { ohMyGulayMenu } from './menus/ohMyGulay';
import { ujiMatchaCafeMenu } from './menus/ujiMatchaCafe';
import { agaraRamenMenu } from './menus/agaraRamen';
import { kocoCafeMenu } from './menus/kocoCafe';
import { hirayaCafeMenu } from './menus/hirayaCafe';

function entry(
  base: Omit<Cafe, 'fullMenu' | 'hasMenu' | 'image'> & { image?: string | null },
  fullMenu?: FullMenu
): Cafe {
  const { image, ...rest } = base;
  return { ...rest, image: image ?? null, fullMenu: fullMenu ?? EMPTY_MENU, hasMenu: fullMenu !== undefined };
}

export const CAFES: Cafe[] = [
  entry(
    {
      name: 'Good Shepherd Cafe',
      cuisine: ['Cafe', 'Coffee'],
      priceRange: { min: 125, max: 210 },
      location: 'Beside Baguio Cathedral',
      popularFor: ['Coffee', 'Local Beans'],
      about: 'A cozy cafe beside Baguio Cathedral serving locally sourced coffee and snacks.',
      hours: '8:00 AM - 6:00 PM',
      dietaryOptions: [],
      tags: ['Cafe', 'Coffee', 'Baguio'],
      image: '/images/goodsheperd.jpg',
    },
    goodShepherdCafeMenu
  ),
  entry(
    {
      name: 'Oh My Gulay',
      cuisine: ['Filipino', 'Vegetarian'],
      priceRange: { min: 200, max: 225 },
      location: 'La Azotea Building, Session Road',
      popularFor: ['Vegetarian', 'Artistic Ambiance'],
      about: 'A vegetarian restaurant and art space with creative Filipino dishes and a unique atmosphere.',
      hours: '11:00 AM - 9:00 PM',
      dietaryOptions: ['Vegetarian'],
      tags: ['Vegetarian', 'Filipino', 'Baguio'],
      image: '/images/ohmygulay.jpg',
    },
    ohMyGulayMenu
  ),
  entry(
    {
      name: 'Uji-Matcha Cafe',
      cuisine: ['Cafe', 'Japanese', 'Tea'],
      priceRange: { min: 100, max: 165 },
      location: 'Porta Vaga Mall, Session Road',
      popularFor: ['Matcha', 'Japanese Drinks'],
      about: 'A specialty cafe offering authentic Japanese matcha drinks and desserts.',
      hours: '10:00 AM - 8:00 PM',
      dietaryOptions: ['Vegetarian', 'Halal'],
      tags: ['Cafe', 'Matcha', 'Japanese', 'Baguio'],
      image: '/images/ujimatcha.jpg',
    },
    ujiMatchaCafeMenu
  ),
  entry({
    name: 'K-Flavors Buffet',
    cuisine: ['Korean', 'Buffet'],
    priceRange: { min: 399, max: 499 },
    location: 'Upper Session Road',
    popularFor: ['Buffet', 'Korean BBQ'],
    about: 'A popular Korean buffet spot with a wide selection of meats and side dishes.',
    hours: '11:00 AM - 10:00 PM',
    dietaryOptions: [],
    tags: ['Korean', 'Buffet', 'Baguio'],
  }),
  entry({
    name: 'Myeong Dong Jjigae Restaurant',
    cuisine: ['Korean', 'Buffet'],
    priceRange: { min: 399, max: 699 },
    location: 'Session Road',
    popularFor: ['Korean Buffet', 'Jjigae', 'Samgyeopsal'],
    about: 'Authentic Korean restaurant specializing in traditional jjigae and buffet options.',
    hours: '11:00 AM - 9:00 PM',
    dietaryOptions: [],
    tags: ['Korean', 'Buffet', 'Jjigae', 'Baguio'],
  }),
  entry({
    name: 'Itaewon Cafe',
    cuisine: ['Korean', 'Cafe'],
    priceRange: { min: 115, max: 220 },
    location: 'Baguio City',
    popularFor: ['Korean Street Food', 'Specialty Drinks', 'Artisanal Coffee'],
    about:
      'Itaewon Café is a Korean-inspired spot in Baguio known for its minimalist interiors, cozy atmosphere, and aesthetic appeal. It serves a mix of Korean street food, specialty drinks, and artisanal coffee that attracts students, couples, and K-culture fans. With warm lighting and IG-worthy corners, it’s a favorite hangout for those seeking a quiet yet stylish café experience.',
    hours: '11:00 AM - 9:00 PM',
    dietaryOptions: [],
    tags: ['Korean', 'Cafe', 'Baguio', 'K-Culture'],
  }),
  entry({
    name: 'Chimichanga by Jaimes Family Feast',
    cuisine: ['Mexican', 'Filipino'],
    priceRange: { min: 50, max: 738 },
    location: "Near Children's Park",
    popularFor: ['Chimichanga', 'Birria Tacos', 'Nacho Fiesta', 'Bagnet Kare-Kare'],
    about:
      "Jaime's Family Feast offers a delicious fusion of Mexican and Filipino cuisine, proudly serving bestsellers like chimichanga, birria tacos, and nacho fiesta alongside Filipino favorites such as bagnet kare-kare and crispy 6-piece fried chicken. Located near Children's Park, it's the perfect spot to enjoy flavorful comfort food with family and friends.",
    hours: 'Breakfast, Snacks, Dinner',
    dietaryOptions: ['Vegetarian', 'Vegan', 'Halal'],
    tags: ['Mexican', 'Filipino', 'Fusion', 'Baguio'],
  }),
  entry({
    name: 'Kapi Kullaaw',
    cuisine: ['Cafe', 'Coffee', 'Snacks'],
    priceRange: { min: 95, max: 250 },
    location: 'Ili-likha Artist Village, Baguio City',
    popularFor: ['Local Coffee Beans', 'Frappes', 'Cozy Ambiance'],
    about:
      "A cozy café nestled within the Ili-likha Artist Village in Baguio City. Known for its thoughtfully curated coffee selection and vibrant, creative atmosphere, it's the perfect hideaway for art lovers, coffee enthusiasts, and curious wonderers alike. Kapi Kullaaw isn't just a cafe, it's a space to slow down, soak in inspiration, and connect with the creative spirits of Baguio.",
    hours: 'Not specified',
    dietaryOptions: ['Vegan', 'Vegetarian', 'Halal'],
    tags: ['Cafe', 'Coffee', 'Art', 'Baguio'],
  }),
  entry({
    name: 'Café De Casa',
    cuisine: ['Cafe', 'Coffee', 'Artisanal'],
    priceRange: { min: 50, max: 90 },
    location: 'Baguio City',
    popularFor: ['Artisanal Bread', 'Specialty Coffee', 'Home-based Baking'],
    about:
      'As home-based bakers and baristas, our goal is to establish Café de Casa as a beloved neighborhood destination for artisanal bread and specialty coffee. We aim to deliver warmth, quality, and a sense of community—from our home to yours—through handcrafted baked goods and passionately brewed espresso-based drinks, made with beans sourced from local farmers and roasters.',
    hours: 'Breakfast, Snacks',
    dietaryOptions: ['Vegetarian', 'Halal'],
    tags: ['Cafe', 'Coffee', 'Artisanal', 'Baguio', 'Home-based'],
  }),
  entry(
    {
      name: 'Agara Ramen',
      cuisine: ['Japanese', 'Ramen'],
      priceRange: { min: 249, max: 399 },
      location: 'Baguio City',
      popularFor: ['Authentic Ramen', 'Tonkotsu Broth', 'Chashu', 'Japanese Cuisine'],
      about:
        'Agara Ramen offers a variety of rich, flavorful ramen bowls crafted with authentic broths like shoyu, miso, and tonkotsu, complemented by fresh toppings such as tender chashu, soft-boiled eggs, and savory sides like gyoza and takoyaki.',
      hours: 'Dinner',
      dietaryOptions: [],
      tags: ['Japanese', 'Ramen', 'Authentic', 'Baguio'],
    },
    agaraRamenMenu
  ),
  entry(
    {
      name: 'KoCo Cafe',
      cuisine: ['Cafe', 'Bistro', 'Comfort Food'],
      priceRange: { min: 120, max: 330 },
      location: 'Baguio City',
      popularFor: ['Specialty Coffee', 'Comfort Food', 'Decadent Desserts', 'Cozy Atmosphere'],
      about:
        "KoCO Café in Baguio City is a cozy café and bistro offering specialty coffee, comfort food, and decadent desserts in a warm, inviting space that captures Baguio's relaxed and creative vibe.",
      hours: 'Snacks',
      dietaryOptions: ['Vegetarian', 'Halal'],
      tags: ['Cafe', 'Bistro', 'Coffee', 'Comfort Food', 'Baguio'],
    },
    kocoCafeMenu
  ),
  entry({
    name: "Farmer's Daughter",
    cuisine: ['Filipino', 'Ilocano', 'Cordilleran'],
    priceRange: { min: 120, max: 170 },
    location: 'Baguio City',
    popularFor: ['Farm-to-Table', 'Local Ingredients', 'Traditional Cordilleran Dishes', 'Authentic Filipino Cuisine'],
    about:
      "Farmer's Daughter in Baguio serves a delightful farm-to-table experience, offering a menu filled with wholesome, locally-sourced Filipino dishes, from hearty breakfasts to flavorful mains, all set in a charming and rustic ambiance that celebrates the best of Baguio's fresh ingredients.",
    hours: 'Lunch/Dinner',
    dietaryOptions: [],
    tags: ['Filipino', 'Ilocano', 'Cordilleran', 'Farm-to-Table', 'Traditional', 'Baguio'],
  }),
  entry(
    {
      name: 'Hiraya Cafe',
      cuisine: ['Filipino', 'Cafe', 'Comfort Food'],
      priceRange: { min: 120, max: 285 },
      location: 'Baguio City',
      popularFor: ['Freshly Brewed Coffee', 'Filipino-Inspired Comfort Food', 'Indulgent Desserts', 'Cozy Atmosphere'],
      about:
        'Hiraya Café in Baguio offers a cozy, inviting space where guests can enjoy a delightful mix of freshly brewed coffee, Filipino-inspired comfort food, and indulgent desserts, perfect for a relaxing break or a satisfying meal.',
      hours: 'All',
      dietaryOptions: ['Vegetarian', 'Vegan', 'Halal'],
      tags: ['Filipino', 'Cafe', 'Coffee', 'Comfort Food', 'Desserts', 'Baguio'],
    },
    hirayaCafeMenu
  ),
  entry({
    name: 'BlendLab Cafe',
    cuisine: ['Cafe', 'Coffee', 'Filipino'],
    priceRange: { min: 70, max: 175 },
    location: 'Baguio City',
    popularFor: ['Specialty Coffee', 'Expertly Crafted Drinks', 'Delectable Pastries', 'Trendy Atmosphere'],
    about:
      'BlendLab Café in Baguio is a trendy, inviting spot known for its specialty coffee, expertly crafted drinks, and delectable pastries. With a modern atmosphere and carefully curated menu, it’s the perfect place for coffee enthusiasts and food lovers alike.',
    hours: 'Breakfast, Lunch, Snacks',
    dietaryOptions: ['Vegetarian'],
    tags: ['Cafe', 'Coffee', 'Specialty', 'Trendy', 'Baguio'],
  }),
  entry({
    name: 'Kubo Grill Baguio',
    cuisine: ['Filipino', 'Grilled', 'Comfort Food'],
    priceRange: { min: 349, max: 449 },
    location: 'Baguio City',
    popularFor: ['Grilled Specialties', 'Unlimited Pork', 'Unlimited Beef', 'Rustic Ambiance'],
    about:
      'Kubo Grill Baguio offers a cozy, laid-back dining experience with a diverse menu of grilled specialties, hearty Filipino comfort food, and refreshing beverages, all served in a charming rustic ambiance perfect for family and friends.',
    hours: 'All',
    dietaryOptions: [],
    tags: ['Filipino', 'Grilled', 'Comfort Food', 'Unlimited', 'Baguio'],
  }),
  entry({
    name: 'Som Tam Thai Restaurant',
    cuisine: ['Thai', 'Asian', 'Authentic'],
    priceRange: { min: 30, max: 340 },
    location: 'Baguio City',
    popularFor: ['Signature Papaya Salad', 'Flavorful Stir-fries', 'Aromatic Curries', 'Authentic Thai Cuisine'],
    about:
      'Som Tam Thai Restaurant in Baguio offers a vibrant, authentic taste of Thailand with their signature papaya salad, flavorful stir-fries, aromatic curries, and refreshing beverages, all crafted with fresh, local ingredients.',
    hours: 'Lunch/Dinner',
    dietaryOptions: ['Halal', 'Vegetarian'],
    tags: ['Thai', 'Asian', 'Authentic', 'Spicy', 'Curry', 'Baguio'],
  }),
  entry({
    name: 'Kubo Grill',
    cuisine: ['Filipino', 'Korean', 'Grilled'],
    priceRange: { min: 299, max: 499 },
    location: 'Baguio City',
    popularFor: ['Beef Samgyupsal', 'Beef Bulgogi', 'Korean-Filipino Fusion', 'Rustic Kubo Ambiance'],
    about:
      'Kubo Grill in Baguio City is a laid-back Filipino restaurant known for its rustic kubo-style ambiance and hearty grilled dishes, perfect for casual dining and enjoying local flavors with family and friends.',
    hours: 'Lunch/Dinner',
    dietaryOptions: [],
    tags: ['Filipino', 'Korean', 'Grilled', 'Fusion', 'Casual', 'Baguio'],
  }),
  entry({
    name: 'Yoshimeatsu Baguio City',
    cuisine: ['Korean', 'Japanese', 'Buffet'],
    priceRange: { min: 38, max: 200 },
    location: 'Baguio City',
    popularFor: ['Unlimited Barbecue', 'Sushi', 'Korean BBQ', 'Japanese Side Dishes'],
    about:
      'Yoshimeatsu Baguio City is a lively Korean-Japanese restaurant offering unlimited barbecue, sushi, and a variety of side dishes, making it a go-to spot for hearty meals and group dining in a vibrant setting.',
    hours: 'Lunch/Dinner',
    dietaryOptions: [],
    tags: ['Korean', 'Japanese', 'Buffet', 'Unlimited', 'BBQ', 'Sushi', 'Baguio'],
  }),
  entry({
    name: 'Ali House of Shawarma Halal',
    cuisine: ['Middle Eastern', 'Halal', 'Mediterranean'],
    priceRange: { min: 30, max: 270 },
    location: 'Baguio City',
    popularFor: ['Shawarma Wraps', 'Beef Biryani', 'Halal Cuisine', 'Middle Eastern Flavors'],
    about:
      'Ali House of Shawarma is a popular spot serving flavorful Middle Eastern-inspired dishes, specializing in generously filled shawarma wraps, rice plates, and refreshing beverages in a casual and welcoming setting.',
    hours: 'Lunch/Dinner',
    dietaryOptions: ['Halal'],
    tags: ['Middle Eastern', 'Halal', 'Shawarma', 'Biryani', 'Mediterranean', 'Baguio'],
  }),
  entry({
    name: 'Loop By Canto',
    cuisine: ['Cafe', 'Comfort Food', 'International'],
    priceRange: { min: 80, max: 350 },
    location: 'Baguio City',
    popularFor: ['Specialty Coffee', 'Comfort Food', 'Creative Pandesal Dishes', 'Refreshing Drinks'],
    about:
      'Loop by Canto in Baguio City is a cozy café-restaurant offering a creative mix of comfort food, specialty coffee, and refreshing drinks in a vibrant yet relaxing atmosphere perfect for locals and tourists alike.',
    hours: 'Snacks',
    dietaryOptions: ['Vegetarian'],
    tags: ['Cafe', 'Coffee', 'Comfort Food', 'Creative', 'International', 'Baguio'],
  }),
];

export function findCafe(name: string): Cafe | undefined {
  return CAFES.find((c) => c.name === name);
}

/** Local suggestion engine: filter by budget ceiling + cuisine + diet. No AI, no network — real filtering. */
export function suggestCafes(input: {
  maxBudget?: number | null;
  cuisine?: string | null;
  dietary?: string[];
  limit?: number;
}): Cafe[] {
  const diet = (input.dietary ?? []).map((d) => d.toLowerCase());
  return CAFES.filter((c) => {
    if (input.maxBudget != null && c.priceRange.min > input.maxBudget) return false;
    if (input.cuisine && !c.cuisine.some((x) => x.toLowerCase().includes(input.cuisine as string))) return false;
    if (diet.length > 0) {
      const has = c.dietaryOptions.map((d) => d.toLowerCase());
      if (!diet.every((d) => has.includes(d))) return false;
    }
    return true;
  }).slice(0, input.limit ?? 6);
}
