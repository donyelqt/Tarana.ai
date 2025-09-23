// ====================================================================
// HIRAYA CAFE MENU DATA
// ====================================================================
// Hiraya Café in Baguio offers a cozy, inviting space where guests can enjoy 
// freshly brewed coffee, Filipino-inspired comfort food, and indulgent desserts.
// ====================================================================

import { FullMenu } from "../types";

export const hirayaCafeMenu: FullMenu = {
  Breakfast: [
    {
      name: "Mac & Cheese",
      description: "Creamy, cheesy baked pasta comfort dish.",
      price: 270,
      image: "/images/placeholders/pasta.png",
    },
    {
      name: "Hungarian Breakfast",
      description: "Hearty breakfast plate with Hungarian sausage and sides.",
      price: 265,
      image: "/images/placeholders/breakfast.png",
    },
    {
      name: "All-American Breakfast",
      description: "Classic breakfast plate with eggs, meat, and toast.",
      price: 275,
      image: "/images/placeholders/breakfast.png",
    },
  ],
  Lunch: [
    {
      name: "Alfredo with Kiniing",
      description: "Rich Alfredo pasta topped with smoked meat (Kiniing).",
      price: 285,
      image: "/images/placeholders/pasta.png",
    },
    {
      name: "Beef Ragu",
      description: "Pasta with slow-cooked beef in a tomato-based sauce.",
      price: 265,
      image: "/images/placeholders/pasta.png",
    },
    {
      name: "Pesto",
      description: "Pasta tossed in aromatic basil pesto sauce.",
      price: 285,
      image: "/images/placeholders/pasta.png",
    },
    {
      name: "Beef Tapa",
      description: "Marinated Filipino beef served with garlic rice and egg.",
      price: 285,
      image: "/images/placeholders/beef.png",
    },
    {
      name: "Sisig Rice",
      description: "Filipino sizzling chopped pork served over rice.",
      price: 285,
      image: "/images/placeholders/pork.png",
    },
    {
      name: "Chicken Ala King",
      description: "Creamy chicken stew served with rice or bread.",
      price: 275,
      image: "/images/placeholders/chicken.png",
    },
    {
      name: "Lechon Kawali with Bagoong Rice",
      description: "Crispy pork belly with bagoong (shrimp paste) rice.",
      price: 285,
      image: "/images/placeholders/pork.png",
    },
  ],
  Dinner: [
    {
      name: "Chili-con Pasta",
      description: "Pasta tossed in chili con carne sauce with a spicy kick.",
      price: 265,
      image: "/images/placeholders/pasta.png",
    },
    {
      name: "Mac & Cheese",
      description: "Creamy, cheesy baked pasta comfort dish.",
      price: 270,
      image: "/images/placeholders/pasta.png",
    },
    {
      name: "Beef Lasagna",
      description: "Layered pasta with beef, tomato sauce, and cheese.",
      price: 285,
      image: "/images/placeholders/pasta.png",
    },
    {
      name: "Chicken Parmegiana",
      description: "Breaded chicken cutlet with marinara sauce and cheese.",
      price: 275,
      image: "/images/placeholders/chicken.png",
    },
    {
      name: "Chicken Ala King",
      description: "Creamy chicken stew served with rice or bread.",
      price: 275,
      image: "/images/placeholders/chicken.png",
    },
  ],
  Snacks: [],
  Drinks: [
    // Coffee Drinks
    {
      name: "Long Black",
      description: "Bold espresso over hot water for a strong flavor.",
      price: 135,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Cafe Latte",
      description: "Smooth espresso with steamed milk and foam.",
      price: 145,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Spanish Latte",
      description: "Espresso latte sweetened with condensed milk.",
      price: 175,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Caramel Latte",
      description: "Espresso latte with rich caramel flavor.",
      price: 175,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Mocha",
      description: "Chocolate-flavored espresso latte.",
      price: 175,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Cinnamon",
      description: "Espresso or latte infused with a dash of cinnamon.",
      price: 175,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Hazelnut",
      description: "Espresso drink with nutty hazelnut syrup.",
      price: 185,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Salted Caramel",
      description: "Espresso with a sweet-salty caramel twist.",
      price: 185,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Peppermint Mocha",
      description: "Espresso with chocolate and peppermint.",
      price: 185,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "White Berry Mocha",
      description: "White mocha with sweet berry accents.",
      price: 185,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Dirty Matcha",
      description: "Matcha latte topped with a bold espresso shot.",
      price: 185,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Hiraya Signature",
      description: "House specialty coffee creation.",
      price: 195,
      image: "/images/placeholders/coffee.png",
    },
    // Non-Coffee Drinks
    {
      name: "Choco Latte",
      description: "Smooth and creamy hot chocolate.",
      price: 175,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Matcha Latte",
      description: "Matcha green tea latte with milk.",
      price: 185,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Strawberry Choco",
      description: "Strawberry and chocolate milk blend.",
      price: 185,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Peppermint Choco",
      description: "Peppermint-infused hot chocolate.",
      price: 185,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Strawberry Matcha Mint",
      description: "Strawberry, matcha, and mint in a refreshing blend.",
      price: 185,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Ube Halaya",
      description: "Creamy purple yam-based dessert drink.",
      price: 195,
      image: "/images/placeholders/coffee.png",
    },
    // Refreshers (Iced)
    {
      name: "Coco Mint",
      description: "Coconut-infused drink with a minty finish.",
      price: 120,
      image: "/images/placeholders/juice.png",
    },
    {
      name: "Tropical Sunrise",
      description: "Bright and tropical citrus-fruit iced drink.",
      price: 120,
      image: "/images/placeholders/juice.png",
    },
    {
      name: "Guava Iced Tea",
      description: "Fruity guava-flavored iced tea.",
      price: 120,
      image: "/images/placeholders/juice.png",
    },
    {
      name: "Green Mango",
      description: "Tangy green mango-flavored iced beverage.",
      price: 130,
      image: "/images/placeholders/juice.png",
    },
    {
      name: "Rose Butterfly",
      description: "Floral drink with butterfly pea flower and rose essence.",
      price: 130,
      image: "/images/placeholders/juice.png",
    },
    {
      name: "Raspberry Reverie",
      description: "Sweet and tangy raspberry iced refresher.",
      price: 130,
      image: "/images/placeholders/juice.png",
    },
    {
      name: "Citron Mint Frizz",
      description: "Citrus and mint drink with a sparkling twist.",
      price: 140,
      image: "/images/placeholders/juice.png",
    },
    {
      name: "Chai Garden Delight",
      description: "Spiced chai tea with a refreshing iced finish.",
      price: 140,
      image: "/images/placeholders/juice.png",
    },
    {
      name: "Peach Yogo",
      description: "Yogurt-based peach-flavored iced drink.",
      price: 140,
      image: "/images/placeholders/juice.png",
    },
    {
      name: "Lychee Berry Yogo",
      description: "Yogurt-based drink with lychee and berries.",
      price: 140,
      image: "/images/placeholders/juice.png",
    },
  ],
};
