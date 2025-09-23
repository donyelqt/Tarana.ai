// ====================================================================
// KUBO GRILL MENU DATA
// ====================================================================
// Kubo Grill in Baguio City is a laid-back Filipino restaurant known for its 
// rustic kubo-style ambiance and hearty grilled dishes, perfect for casual 
// dining and enjoying local flavors with family and friends.
// ====================================================================

import { FullMenu } from "../types";

export const kuboGrillMenu: FullMenu = {
  Breakfast: [],
  Lunch: [
    {
      name: "Beef Samgyupsal",
      description: "Korean-style grilled beef served with ONE Korean Ice Cream",
      price: 499,
      image: "/images/placeholders/beef.png",
    },
    {
      name: "Beef Bulgogi",
      description: "Marinated Korean beef bulgogi served with ONE Korean Ice Cream",
      price: 369,
      image: "/images/placeholders/beef.png",
    },
    {
      name: "Pork & Chicken",
      description: "Grilled pork and chicken combo served with ONE Korean Ice Cream",
      price: 299,
      image: "/images/placeholders/pork.png",
    },
  ],
  Dinner: [
    {
      name: "Beef Samgyupsal",
      description: "Korean-style grilled beef served with ONE Korean Ice Cream",
      price: 499,
      image: "/images/placeholders/beef.png",
    },
    {
      name: "Beef Bulgogi",
      description: "Marinated Korean beef bulgogi served with ONE Korean Ice Cream",
      price: 369,
      image: "/images/placeholders/beef.png",
    },
    {
      name: "Pork & Chicken",
      description: "Grilled pork and chicken combo served with ONE Korean Ice Cream",
      price: 299,
      image: "/images/placeholders/pork.png",
    },
  ],
  Snacks: [],
  Drinks: [],
};
