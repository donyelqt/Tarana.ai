// ====================================================================
// RESTAURANT DATA
// ====================================================================
//
// This file contains the complete restaurant data with all details
// for the Tarana Eats feature.
//
// ====================================================================

import { RestaurantData, FullMenu } from "./types";
import { goodShepherdCafeMenu } from "./menus/goodShepherdCafe";
import { myeongDongJjigaeMenu } from "./menus/myeongDongJjigae";
import { ohMyGulayMenu } from "./menus/ohMyGulay";
import { ujiMatchaCafeMenu } from "./menus/ujiMatchaCafe";
import { kFlavorsBuffetMenu } from "./menus/kFlavorsBuffet";
import { itaewonCafeMenu } from "./menus/itaewonCafe";
import { chimichangaJaimesFamilyFeastMenu } from "./menus/chimichangaJaimesFamilyFeast";
import { kapiKullaawMenu } from "./menus/kapiKullaaw";
import { cafeDeCasaMenu } from "./menus/cafeDeCasa";
import { agaraRamenMenu } from "./menus/agaraRamen";
import { kocoCafeMenu } from "./menus/kocoCafe";
import { farmersDaughterMenu } from "./menus/farmersDaughter";
import { hirayaCafeMenu } from "./menus/hirayaCafe";
import { blendlabCafeMenu } from "./menus/blendlabCafe";
import { kuboGrillBaguioMenu } from "./menus/kuboGrillBaguio";
import { somTamThaiRestaurantMenu } from "./menus/somTamThaiRestaurant";
import { kuboGrillMenu } from "./menus/kuboGrill";
import { yoshimeatsuBaguioCityMenu } from "./menus/yoshimeatsuBaguioCity";
import { aliHouseOfShawarmaHalalMenu } from "./menus/aliHouseOfShawarmaHalal";
import { loopByCantoMenu } from "./menus/loopByCanto";

export const restaurants: RestaurantData[] = [
  {
    name: "Good Shepherd Cafe",
    cuisine: ["Cafe", "Coffee"],
    priceRange: {
      min: 125,
      max: 210,
    },
    location: "Beside Baguio Cathedral",
    popularFor: ["Coffee", "Local Beans"],
    menuItems: [],
    fullMenu: goodShepherdCafeMenu,
    image: "/images/goodsheperd.jpg",
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
    image: "/images/ujimatcha.jpg",
    tags: ["Cafe", "Matcha", "Japanese", "Baguio"],
    dietaryOptions: ["Vegetarian", "Halal"],
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
    image: "/images/kflavors.jpg",
    tags: ["Korean", "Buffet", "Baguio"],
    dietaryOptions: [],
    about: "A popular Korean buffet spot with a wide selection of meats and side dishes.",
    hours: "11:00 AM - 10:00 PM",
  },
  {
    name: "Myeong Dong Jjigae Restaurant",
    cuisine: ["Korean", "Buffet"],
    priceRange: {
      min: 399,
      max: 699,
    },
    location: "Session Road",
    popularFor: ["Korean Buffet", "Jjigae", "Samgyeopsal"],
    menuItems: [],
    fullMenu: myeongDongJjigaeMenu,
    image: "/images/myeongdong.jpg",
    tags: ["Korean", "Buffet", "Jjigae", "Baguio"],
    dietaryOptions: [],
    about: "Authentic Korean restaurant specializing in traditional jjigae and buffet options.",
    hours: "11:00 AM - 9:00 PM",
  },
  {
    name: "Itaewon Cafe",
    cuisine: ["Korean", "Cafe"],
    priceRange: {
      min: 115,
      max: 220,
    },
    location: "Baguio City",
    popularFor: ["Korean Street Food", "Specialty Drinks", "Artisanal Coffee"],
    menuItems: [],
    fullMenu: itaewonCafeMenu,
    image: "/images/itaewon.jpg",
    tags: ["Korean", "Cafe", "Baguio", "K-Culture"],
    dietaryOptions: [],
    about: "Itaewon Café is a Korean-inspired spot in Baguio known for its minimalist interiors, cozy atmosphere, and aesthetic appeal. It serves a mix of Korean street food, specialty drinks, and artisanal coffee that attracts students, couples, and K-culture fans. With warm lighting and IG-worthy corners, it's a favorite hangout for those seeking a quiet yet stylish café experience.",
    hours: "11:00 AM - 9:00 PM",
  },
  {
    name: "Chimichanga by Jaimes Family Feast",
    cuisine: ["Mexican", "Filipino"],
    priceRange: {
      min: 50,
      max: 738,
    },
    location: "Near Children's Park",
    popularFor: ["Chimichanga", "Birria Tacos", "Nacho Fiesta", "Bagnet Kare-Kare"],
    menuItems: [],
    fullMenu: chimichangaJaimesFamilyFeastMenu,
    image: "/images/chimichanga.jpg",
    tags: ["Mexican", "Filipino", "Fusion", "Baguio"],
    dietaryOptions: ["Vegetarian", "Vegan", "Halal"],
    about: "Jaime's Family Feast offers a delicious fusion of Mexican and Filipino cuisine, proudly serving bestsellers like chimichanga, birria tacos, and nacho fiesta alongside Filipino favorites such as bagnet kare-kare and crispy 6-piece fried chicken. Located near Children's Park, it's the perfect spot to enjoy flavorful comfort food with family and friends.",
    hours: "Breakfast, Snacks, Dinner",
  },
  {
    name: "Kapi Kullaaw",
    cuisine: ["Cafe", "Coffee", "Snacks"],
    priceRange: {
      min: 95,
      max: 250,
    },
    location: "Ili-likha Artist Village, Baguio City",
    popularFor: ["Local Coffee Beans", "Frappes", "Cozy Ambiance"],
    menuItems: [],
    fullMenu: kapiKullaawMenu,
    image: "/images/kapi-kullaaw.jpg", // Assuming a placeholder image path
    tags: ["Cafe", "Coffee", "Art", "Baguio"],
    dietaryOptions: ["Vegan", "Vegetarian", "Halal"],
    about:
      "A cozy café nestled within the Ili-likha Artist Village in Baguio City. Known for its thoughtfully curated coffee selection and vibrant, creative atmosphere, it's the perfect hideaway for art lovers, coffee enthusiasts, and curious wonderers alike. Kapi Kullaaw isn't just a cafe, it's a space to slow down, soak in inspiration, and connect with the creative spirits of Baguio.",
    hours: "Not specified", // You can update this if you have the hours
  },
  {
    name: "Café De Casa",
    cuisine: ["Cafe", "Coffee", "Artisanal"],
    priceRange: {
      min: 50,
      max: 90,
    },
    location: "Baguio City",
    popularFor: ["Artisanal Bread", "Specialty Coffee", "Home-based Baking"],
    menuItems: [],
    fullMenu: cafeDeCasaMenu,
    image: "/images/cafe-de-casa.jpg",
    tags: ["Cafe", "Coffee", "Artisanal", "Baguio", "Home-based"],
    dietaryOptions: ["Vegetarian", "Halal"],
    about:
      "As home-based bakers and baristas, our goal is to establish Café de Casa as a beloved neighborhood destination for artisanal bread and specialty coffee. We aim to deliver warmth, quality, and a sense of community—from our home to yours—through handcrafted baked goods and passionately brewed espresso-based drinks, made with beans sourced from local farmers and roasters.",
    hours: "Breakfast, Snacks",
  },
  {
    name: "Agara Ramen",
    cuisine: ["Japanese", "Ramen"],
    priceRange: {
      min: 249,
      max: 399,
    },
    location: "Baguio City",
    popularFor: ["Authentic Ramen", "Tonkotsu Broth", "Chashu", "Japanese Cuisine"],
    menuItems: [],
    fullMenu: agaraRamenMenu,
    image: "/images/agara-ramen.jpg",
    tags: ["Japanese", "Ramen", "Authentic", "Baguio"],
    dietaryOptions: [],
    about:
      "Agara Ramen offers a variety of rich, flavorful ramen bowls crafted with authentic broths like shoyu, miso, and tonkotsu, complemented by fresh toppings such as tender chashu, soft-boiled eggs, and savory sides like gyoza and takoyaki.",
    hours: "Dinner",
  },
  {
    name: "KoCo Cafe",
    cuisine: ["Cafe", "Bistro", "Comfort Food"],
    priceRange: {
      min: 120,
      max: 330,
    },
    location: "Baguio City",
    popularFor: ["Specialty Coffee", "Comfort Food", "Decadent Desserts", "Cozy Atmosphere"],
    menuItems: [],
    fullMenu: kocoCafeMenu,
    image: "/images/koco-cafe.jpg",
    tags: ["Cafe", "Bistro", "Coffee", "Comfort Food", "Baguio"],
    dietaryOptions: ["Vegetarian", "Halal"],
    about:
      "KoCO Café in Baguio City is a cozy café and bistro offering specialty coffee, comfort food, and decadent desserts in a warm, inviting space that captures Baguio's relaxed and creative vibe.",
    hours: "Snacks",
  },
  {
    name: "Farmer's Daughter",
    cuisine: ["Filipino", "Ilocano", "Cordilleran"],
    priceRange: {
      min: 120,
      max: 170,
    },
    location: "Baguio City",
    popularFor: ["Farm-to-Table", "Local Ingredients", "Traditional Cordilleran Dishes", "Authentic Filipino Cuisine"],
    menuItems: [],
    fullMenu: farmersDaughterMenu,
    image: "/images/farmers-daughter.jpg",
    tags: ["Filipino", "Ilocano", "Cordilleran", "Farm-to-Table", "Traditional", "Baguio"],
    dietaryOptions: [],
    about:
      "Farmer's Daughter in Baguio serves a delightful farm-to-table experience, offering a menu filled with wholesome, locally-sourced Filipino dishes, from hearty breakfasts to flavorful mains, all set in a charming and rustic ambiance that celebrates the best of Baguio's fresh ingredients.",
    hours: "Lunch/Dinner",
  },
  {
    name: "Hiraya Cafe",
    cuisine: ["Filipino", "Cafe", "Comfort Food"],
    priceRange: {
      min: 120,
      max: 285,
    },
    location: "Baguio City",
    popularFor: ["Freshly Brewed Coffee", "Filipino-Inspired Comfort Food", "Indulgent Desserts", "Cozy Atmosphere"],
    menuItems: [],
    fullMenu: hirayaCafeMenu,
    image: "/images/hiraya-cafe.jpg",
    tags: ["Filipino", "Cafe", "Coffee", "Comfort Food", "Desserts", "Baguio"],
    dietaryOptions: ["Vegetarian", "Vegan", "Halal"],
    about:
      "Hiraya Café in Baguio offers a cozy, inviting space where guests can enjoy a delightful mix of freshly brewed coffee, Filipino-inspired comfort food, and indulgent desserts, perfect for a relaxing break or a satisfying meal.",
    hours: "All",
  },
  {
    name: "BlendLab Cafe",
    cuisine: ["Cafe", "Coffee", "Filipino"],
    priceRange: {
      min: 70,
      max: 175,
    },
    location: "Baguio City",
    popularFor: ["Specialty Coffee", "Expertly Crafted Drinks", "Delectable Pastries", "Trendy Atmosphere"],
    menuItems: [],
    fullMenu: blendlabCafeMenu,
    image: "/images/blendlab-cafe.jpg",
    tags: ["Cafe", "Coffee", "Specialty", "Trendy", "Baguio"],
    dietaryOptions: ["Vegetarian"],
    about:
      "BlendLab Café in Baguio is a trendy, inviting spot known for its specialty coffee, expertly crafted drinks, and delectable pastries. With a modern atmosphere and carefully curated menu, it's the perfect place for coffee enthusiasts and food lovers alike.",
    hours: "Breakfast, Lunch, Snacks",
  },
  {
    name: "Kubo Grill Baguio",
    cuisine: ["Filipino", "Grilled", "Comfort Food"],
    priceRange: {
      min: 349,
      max: 449,
    },
    location: "Baguio City",
    popularFor: ["Grilled Specialties", "Unlimited Pork", "Unlimited Beef", "Rustic Ambiance"],
    menuItems: [],
    fullMenu: kuboGrillBaguioMenu,
    image: "/images/kubo-grill-baguio.jpg",
    tags: ["Filipino", "Grilled", "Comfort Food", "Unlimited", "Baguio"],
    dietaryOptions: [],
    about:
      "Kubo Grill Baguio offers a cozy, laid-back dining experience with a diverse menu of grilled specialties, hearty Filipino comfort food, and refreshing beverages, all served in a charming rustic ambiance perfect for family and friends.",
    hours: "All",
  },
  {
    name: "Som Tam Thai Restaurant",
    cuisine: ["Thai", "Asian", "Authentic"],
    priceRange: {
      min: 30,
      max: 340,
    },
    location: "Baguio City",
    popularFor: ["Signature Papaya Salad", "Flavorful Stir-fries", "Aromatic Curries", "Authentic Thai Cuisine"],
    menuItems: [],
    fullMenu: somTamThaiRestaurantMenu,
    image: "/images/som-tam-thai-restaurant.jpg",
    tags: ["Thai", "Asian", "Authentic", "Spicy", "Curry", "Baguio"],
    dietaryOptions: ["Halal", "Vegetarian"],
    about:
      "Som Tam Thai Restaurant in Baguio offers a vibrant, authentic taste of Thailand with their signature papaya salad, flavorful stir-fries, aromatic curries, and refreshing beverages, all crafted with fresh, local ingredients.",
    hours: "Lunch/Dinner",
  },
  {
    name: "Kubo Grill",
    cuisine: ["Filipino", "Korean", "Grilled"],
    priceRange: {
      min: 299,
      max: 499,
    },
    location: "Baguio City",
    popularFor: ["Beef Samgyupsal", "Beef Bulgogi", "Korean-Filipino Fusion", "Rustic Kubo Ambiance"],
    menuItems: [],
    fullMenu: kuboGrillMenu,
    image: "/images/kubo-grill.jpg",
    tags: ["Filipino", "Korean", "Grilled", "Fusion", "Casual", "Baguio"],
    dietaryOptions: [],
    about:
      "Kubo Grill in Baguio City is a laid-back Filipino restaurant known for its rustic kubo-style ambiance and hearty grilled dishes, perfect for casual dining and enjoying local flavors with family and friends.",
    hours: "Lunch/Dinner",
  },
  {
    name: "Yoshimeatsu Baguio City",
    cuisine: ["Korean", "Japanese", "Buffet"],
    priceRange: {
      min: 38,
      max: 200,
    },
    location: "Baguio City",
    popularFor: ["Unlimited Barbecue", "Sushi", "Korean BBQ", "Japanese Side Dishes"],
    menuItems: [],
    fullMenu: yoshimeatsuBaguioCityMenu,
    image: "/images/yoshimeatsu-baguio-city.jpg",
    tags: ["Korean", "Japanese", "Buffet", "Unlimited", "BBQ", "Sushi", "Baguio"],
    dietaryOptions: [],
    about:
      "Yoshimeatsu Baguio City is a lively Korean-Japanese restaurant offering unlimited barbecue, sushi, and a variety of side dishes, making it a go-to spot for hearty meals and group dining in a vibrant setting.",
    hours: "Lunch/Dinner",
  },
  {
    name: "Ali House of Shawarma Halal",
    cuisine: ["Middle Eastern", "Halal", "Mediterranean"],
    priceRange: {
      min: 30,
      max: 270,
    },
    location: "Baguio City",
    popularFor: ["Shawarma Wraps", "Beef Biryani", "Halal Cuisine", "Middle Eastern Flavors"],
    menuItems: [],
    fullMenu: aliHouseOfShawarmaHalalMenu,
    image: "/images/ali-house-of-shawarma-halal.jpg",
    tags: ["Middle Eastern", "Halal", "Shawarma", "Biryani", "Mediterranean", "Baguio"],
    dietaryOptions: ["Halal"],
    about:
      "Ali House of Shawarma is a popular spot serving flavorful Middle Eastern-inspired dishes, specializing in generously filled shawarma wraps, rice plates, and refreshing beverages in a casual and welcoming setting.",
    hours: "Lunch/Dinner",
  },
  {
    name: "Loop By Canto",
    cuisine: ["Cafe", "Comfort Food", "International"],
    priceRange: {
      min: 80,
      max: 350,
    },
    location: "Baguio City",
    popularFor: ["Specialty Coffee", "Comfort Food", "Creative Pandesal Dishes", "Refreshing Drinks"],
    menuItems: [],
    fullMenu: loopByCantoMenu,
    image: "/images/loop-by-canto.jpg",
    tags: ["Cafe", "Coffee", "Comfort Food", "Creative", "International", "Baguio"],
    dietaryOptions: ["Vegetarian"],
    about:
      "Loop by Canto in Baguio City is a cozy café-restaurant offering a creative mix of comfort food, specialty coffee, and refreshing drinks in a vibrant yet relaxing atmosphere perfect for locals and tourists alike.",
    hours: "Snacks",
  },
];

// Create a record of all restaurant menus for easy lookup
export const allRestaurantMenus: Record<string, FullMenu> = {
  "Good Shepherd Cafe": goodShepherdCafeMenu,
  "Oh My Gulay": ohMyGulayMenu,
  "Uji-Matcha Cafe": ujiMatchaCafeMenu,
  "K-Flavors Buffet": kFlavorsBuffetMenu,
  "Myeong Dong Jjigae Restaurant": myeongDongJjigaeMenu,
  "Itaewon Cafe": itaewonCafeMenu,
  "Chimichanga by Jaimes Family Feast": chimichangaJaimesFamilyFeastMenu,
  "Kapi Kullaaw": kapiKullaawMenu,
  "Café De Casa": cafeDeCasaMenu,
  "Agara Ramen": agaraRamenMenu,
  "KoCo Cafe": kocoCafeMenu,
  "Farmer's Daughter": farmersDaughterMenu,
  "Hiraya Cafe": hirayaCafeMenu,
  "BlendLab Cafe": blendlabCafeMenu,
  "Kubo Grill Baguio": kuboGrillBaguioMenu,
  "Som Tam Thai Restaurant": somTamThaiRestaurantMenu,
  "Kubo Grill": kuboGrillMenu,
  "Yoshimeatsu Baguio City": yoshimeatsuBaguioCityMenu,
  "Ali House of Shawarma Halal": aliHouseOfShawarmaHalalMenu,
  "Loop By Canto": loopByCantoMenu,
};