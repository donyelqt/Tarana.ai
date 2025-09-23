// ====================================================================
// AGARA RAMEN MENU DATA
// ====================================================================
// Agara Ramen offers a variety of rich, flavorful ramen bowls crafted with 
// authentic broths like shoyu, miso, and tonkotsu, complemented by fresh toppings.
// ====================================================================

import { FullMenu } from "../types";

export const agaraRamenMenu: FullMenu = {
  Breakfast: [],
  Lunch: [],
  Dinner: [
    {
      name: "Shoyu Ramen",
      description: "Soy sauce-based broth with noodles, vegetables, and savory toppings.",
      price: 249,
      image: "/images/placeholders/ramen.png",
    },
    {
      name: "Miso Ramen",
      description: "Rich miso-based soup with ramen noodles and vegetables.",
      price: 249,
      image: "/images/placeholders/ramen.png",
    },
    {
      name: "Shio Ramen",
      description: "Light and salty clear broth with noodles and classic toppings.",
      price: 249,
      image: "/images/placeholders/ramen.png",
    },
    {
      name: "Tonkotsu Ramen",
      description: "Creamy pork bone broth ramen with tender chashu slices.",
      price: 249,
      image: "/images/placeholders/ramen.png",
    },
    {
      name: "Spicy Ramen",
      description: "Bold, spicy broth with noodles and a kick of chili oil.",
      price: 399,
      image: "/images/placeholders/ramen.png",
    },
    {
      name: "Chashu Ramen",
      description: "Ramen topped with thick slices of braised pork belly.",
      price: 399,
      image: "/images/placeholders/ramen.png",
    },
    {
      name: "Vegetarian Ramen",
      description: "Vegetable broth with tofu and seasonal veggies.",
      price: 399,
      image: "/images/placeholders/ramen.png",
    },
    {
      name: "Curry Ramen",
      description: "Japanese-style curry broth with ramen noodles and veggies.",
      price: 399,
      image: "/images/placeholders/ramen.png",
    },
  ],
  Snacks: [],
  Drinks: [],
};
