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
];

// Create a record of all restaurant menus for easy lookup
export const allRestaurantMenus: Record<string, FullMenu> = {
  "Good Shepherd Cafe": goodShepherdCafeMenu,
  "Oh My Gulay": ohMyGulayMenu,
  "Uji-Matcha Cafe": ujiMatchaCafeMenu,
  "K-Flavors Buffet": kFlavorsBuffetMenu,
  "Myeong Dong Jjigae Restaurant": myeongDongJjigaeMenu,
  "Itaewon Cafe": itaewonCafeMenu,
};