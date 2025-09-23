// ====================================================================
// LOOP BY CANTO MENU DATA
// ====================================================================
// Loop by Canto in Baguio City is a cozy café-restaurant offering a creative mix 
// of comfort food, specialty coffee, and refreshing drinks in a vibrant yet 
// relaxing atmosphere perfect for locals and tourists alike.
// ====================================================================

import { FullMenu } from "../types";

export const loopByCantoMenu: FullMenu = {
  Breakfast: [],
  Lunch: [],
  Dinner: [],
  Snacks: [
    // Pandesal Specialties
    {
      name: "Pan de Gogo",
      description: "Soft scrambled eggs, hot pandesal, and salad",
      price: 120,
      image: "/images/placeholders/breakfast.png",
    },
    {
      name: "Eggs Benny Pandesal",
      description: "Poached egg, hollandaise, sauteed spinach and mushrooms, and smoked pork (kiniling).",
      price: 180,
      image: "/images/placeholders/breakfast.png",
    },
    {
      name: "Grilled Cheese Pandesal",
      description: "3 cheese, fried onions, and tomato soup.",
      price: 250,
      image: "/images/placeholders/sandwich.png",
    },
    {
      name: "French Toast Pandesal",
      description: "Sweet pandesal dipped in egg and fried, served with syrup.",
      price: 180,
      image: "/images/placeholders/toast.png",
    },
    // Sweet Treats
    {
      name: "Crepe Suzette",
      description: "Crepes in hot orange sauce, ice cream, granita, orange slices.",
      price: 250,
      image: "/images/placeholders/crepe.png",
    },
    {
      name: "Red Velvet Cookie",
      description: "Red velvet cookie with cream cheese filling",
      price: 110,
      image: "/images/placeholders/cookie.png",
    },
    {
      name: "Chocolate Chip Cookie",
      description: "Classic chewy cookie with chocolate chips.",
      price: 110,
      image: "/images/placeholders/cookie.png",
    },
    {
      name: "Pain au Chocolat",
      description: "Buttery croissant filled with chocolate.",
      price: 100,
      image: "/images/placeholders/pastry.png",
    },
    // Salads & Light Meals
    {
      name: "Garden Fresh Salad",
      description: "Season greens, fruits, with mango or strawberry yoghurt dressing",
      price: 190,
      image: "/images/placeholders/salad.png",
    },
    {
      name: "Taco Salad",
      description: "Nacho chips, lettuce, onions, tomatoes, and cheese.",
      price: 220,
      image: "/images/placeholders/salad.png",
    },
    // Appetizers & Sides
    {
      name: "Truffle Fries",
      description: "Golden fries tossed with truffle oil and parmesan.",
      price: 190,
      image: "/images/placeholders/fries.png",
    },
    {
      name: "Chicken Poppers",
      description: "Bite-sized golden chicken pieces served with honey (+ P20 for extra dip)",
      price: 230,
      image: "/images/placeholders/chicken.png",
    },
    {
      name: "Spicy Chicken Poppers",
      description: "Bite-sized golden spicy chicken pieces served with honey mustard dip. (+ P20 for extra dip)",
      price: 230,
      image: "/images/placeholders/chicken.png",
    },
    {
      name: "Cheese Sticks",
      description: "13 pieces of cheese sticks served with mayo-pineapple dip.",
      price: 120,
      image: "/images/placeholders/appetizer.png",
    },
    // Main Dishes
    {
      name: "Humble-Ger",
      description: "Fried Onion Burger with cheese. Single or Double patty",
      price: 190,
      image: "/images/placeholders/burger.png",
    },
    {
      name: "Chili Dawg",
      description: "Honest Craft Deli Sausages, housemade Chili con Carne, served with fries.",
      price: 280,
      image: "/images/placeholders/hotdog.png",
    },
    {
      name: "Lasagna",
      description: "Classic layered pasta with meat sauce and cheese.",
      price: 250,
      image: "/images/placeholders/pasta.png",
    },
    {
      name: "The Boner",
      description: "Braised and Grilled BBQ Pork Rib, housemade BBQ Sauce, served with cascade salad, rice or mashed potatoes.",
      price: 299,
      image: "/images/placeholders/pork.png",
    },
    {
      name: "Belly Gewd",
      description: "Grilled Beef belly, Au jus, season greens, rice or mashed potatoes.",
      price: 350,
      image: "/images/placeholders/beef.png",
    },
    {
      name: "Fishda",
      description: "Pan-seared Pompano, Cauliflower Puree, sauteed greens and mushroom, butter sauce.",
      price: 350,
      image: "/images/placeholders/fish.png",
    },
    {
      name: "Chicken Wrap or Chicken on Rice",
      description: "Grilled chicken, tzatziki sauce, lettuce, cucumbers, tomatoes, crushed peanuts, bacon bits.",
      price: 280,
      image: "/images/placeholders/wrap.png",
    },
    {
      name: "Beef Kelby",
      description: "Stir Fried Beef strips. salad, fried egg, Nori rice.",
      price: 280,
      image: "/images/placeholders/beef.png",
    },
    // Specialty Drinks - Iced Teas
    {
      name: "Raspberry Iced Tea",
      description: "Fruity iced tea with raspberry flavor.",
      price: 150,
      image: "/images/placeholders/tea.png",
    },
    {
      name: "Green Apple and Kiwi",
      description: "Refreshing blend of green apple and kiwi flavors.",
      price: 150,
      image: "/images/placeholders/drink.png",
    },
    {
      name: "Pink Chamomile",
      description: "Herbal chamomile tea with a floral twist.",
      price: 150,
      image: "/images/placeholders/tea.png",
    },
    {
      name: "Peach Mango",
      description: "Sweet peach and mango iced tea blend.",
      price: 150,
      image: "/images/placeholders/tea.png",
    },
    {
      name: "Wild Berry Soda",
      description: "Sparkling soda infused with mixed berries.",
      price: 150,
      image: "/images/placeholders/soda.png",
    },
    // Coffee & Lattes
    {
      name: "Americano",
      description: "Bold espresso diluted with hot water.",
      price: 110,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Latte",
      description: "Espresso blended with steamed milk.",
      price: 150,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Caramel Latte",
      description: "Sweet caramel-infused latte.",
      price: 150,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Vanilla Latte",
      description: "Latte with smooth vanilla syrup.",
      price: 150,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Spanish Latte",
      description: "Creamy latte with condensed milk and spices.",
      price: 150,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Toffee Latte",
      description: "Latte flavored with buttery toffee syrup.",
      price: 150,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Salted Butterscotch Latte",
      description: "Rich latte with salted butterscotch.",
      price: 150,
      image: "/images/placeholders/coffee.png",
    },
    // Matcha Drinks
    {
      name: "Matcha Latte",
      description: "Smooth matcha green tea latte with milk.",
      price: 150,
      image: "/images/placeholders/matcha.png",
    },
    {
      name: "Strawberry Matcha",
      description: "Matcha latte layered with strawberry syrup.",
      price: 150,
      image: "/images/placeholders/matcha.png",
    },
    {
      name: "Earl Grey Rose Milktea",
      description: "Earl Grey tea latte with a floral rose twist.",
      price: 150,
      image: "/images/placeholders/tea.png",
    },
    // Cereal Milk Series
    {
      name: "Strawberry Matcha",
      description: "Strawberry Syrup + Sliced Fresh Strawberries",
      price: 130,
      image: "/images/placeholders/drink.png",
    },
    {
      name: "Banana Split",
      description: "Cashew Nuts + Sliced Fresh Banana + Caramel Bits",
      price: 130,
      image: "/images/placeholders/drink.png",
    },
    {
      name: "Mango-Cereal",
      description: "Mango bits + Crushed Cereals",
      price: 130,
      image: "/images/placeholders/drink.png",
    },
    {
      name: "Matcha Strawberry",
      description: "Matcha Syrup + Sliced Fresh Strawberries",
      price: 130,
      image: "/images/placeholders/drink.png",
    },
    {
      name: "Oreo Mallows",
      description: "Crush Oreos + Mini Marshmallows",
      price: 130,
      image: "/images/placeholders/drink.png",
    },
    {
      name: "Milo",
      description: "Milo Powder + Milo Cereal",
      price: 130,
      image: "/images/placeholders/drink.png",
    },
    // Sago Series
    {
      name: "Classic",
      description: "Sago + Arnibal",
      price: 80,
      image: "/images/placeholders/sago.png",
    },
    {
      name: "Oreo",
      description: "Sago + Arnibal + Crushed Oreo Topping",
      price: 90,
      image: "/images/placeholders/sago.png",
    },
    {
      name: "Coffee Jelly",
      description: "Sweetener + Coffee Jelly",
      price: 115,
      image: "/images/placeholders/sago.png",
    },
    {
      name: "Nutty Caramel",
      description: "Sago + Caramel + Caramel bits + Cashew Nuts",
      price: 125,
      image: "/images/placeholders/sago.png",
    },
    {
      name: "Mango Graham",
      description: "Sago + Mango Syrup + Crushed Graham Toppings",
      price: 125,
      image: "/images/placeholders/sago.png",
    },
    {
      name: "Strawberry",
      description: "Sago + Strawberry Syrup + Strawberry Bits",
      price: 125,
      image: "/images/placeholders/sago.png",
    },
    {
      name: "Matcha",
      description: "Sago + Matcha Syrup",
      price: 150,
      image: "/images/placeholders/sago.png",
    },
    {
      name: "Mango Sago",
      description: "Cereal-infused milk paired with fresh mango bits and sago, finished with crushed cereal topping. (+ P50 for Oat milk)",
      price: 150,
      image: "/images/placeholders/sago.png",
    },
    {
      name: "Mais con Yelo",
      description: "Cereal-infused milk paired with corn, finished with crushed cereal topping. (+ P50 for Oat milk)",
      price: 150,
      image: "/images/placeholders/dessert.png",
    },
    // Smoothies & Lemonades
    {
      name: "Cheesecake Smoothie",
      description: "Lemon Square Cheesecake smoothie with mango bits",
      price: 130,
      image: "/images/placeholders/smoothie.png",
    },
    {
      name: "Lemonade",
      description: "Classic sweet and tangy lemonade.",
      price: 99,
      image: "/images/placeholders/lemonade.png",
    },
    {
      name: "Orange Lemonade",
      description: "Fresh lemonade infused with orange juice.",
      price: 120,
      image: "/images/placeholders/lemonade.png",
    },
    {
      name: "Strawberry Lemonade",
      description: "Fruity lemonade with strawberry puree.",
      price: 120,
      image: "/images/placeholders/lemonade.png",
    },
  ],
  Drinks: [
    // Specialty Drinks - Iced Teas
    {
      name: "Raspberry Iced Tea",
      description: "Fruity iced tea with raspberry flavor.",
      price: 150,
      image: "/images/placeholders/tea.png",
    },
    {
      name: "Green Apple and Kiwi",
      description: "Refreshing blend of green apple and kiwi flavors.",
      price: 150,
      image: "/images/placeholders/drink.png",
    },
    {
      name: "Pink Chamomile",
      description: "Herbal chamomile tea with a floral twist.",
      price: 150,
      image: "/images/placeholders/tea.png",
    },
    {
      name: "Peach Mango",
      description: "Sweet peach and mango iced tea blend.",
      price: 150,
      image: "/images/placeholders/tea.png",
    },
    {
      name: "Wild Berry Soda",
      description: "Sparkling soda infused with mixed berries.",
      price: 150,
      image: "/images/placeholders/soda.png",
    },
    // Coffee & Lattes
    {
      name: "Americano",
      description: "Bold espresso diluted with hot water.",
      price: 110,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Latte",
      description: "Espresso blended with steamed milk.",
      price: 150,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Caramel Latte",
      description: "Sweet caramel-infused latte.",
      price: 150,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Vanilla Latte",
      description: "Latte with smooth vanilla syrup.",
      price: 150,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Spanish Latte",
      description: "Creamy latte with condensed milk and spices.",
      price: 150,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Toffee Latte",
      description: "Latte flavored with buttery toffee syrup.",
      price: 150,
      image: "/images/placeholders/coffee.png",
    },
    {
      name: "Salted Butterscotch Latte",
      description: "Rich latte with salted butterscotch.",
      price: 150,
      image: "/images/placeholders/coffee.png",
    },
    // Matcha Drinks
    {
      name: "Matcha Latte",
      description: "Smooth matcha green tea latte with milk.",
      price: 150,
      image: "/images/placeholders/matcha.png",
    },
    {
      name: "Strawberry Matcha",
      description: "Matcha latte layered with strawberry syrup.",
      price: 150,
      image: "/images/placeholders/matcha.png",
    },
    {
      name: "Earl Grey Rose Milktea",
      description: "Earl Grey tea latte with a floral rose twist.",
      price: 150,
      image: "/images/placeholders/tea.png",
    },
    // Cereal Milk Series
    {
      name: "Strawberry Matcha",
      description: "Strawberry Syrup + Sliced Fresh Strawberries",
      price: 130,
      image: "/images/placeholders/drink.png",
    },
    {
      name: "Banana Split",
      description: "Cashew Nuts + Sliced Fresh Banana + Caramel Bits",
      price: 130,
      image: "/images/placeholders/drink.png",
    },
    {
      name: "Mango-Cereal",
      description: "Mango bits + Crushed Cereals",
      price: 130,
      image: "/images/placeholders/drink.png",
    },
    {
      name: "Matcha Strawberry",
      description: "Matcha Syrup + Sliced Fresh Strawberries",
      price: 130,
      image: "/images/placeholders/drink.png",
    },
    {
      name: "Oreo Mallows",
      description: "Crush Oreos + Mini Marshmallows",
      price: 130,
      image: "/images/placeholders/drink.png",
    },
    {
      name: "Milo",
      description: "Milo Powder + Milo Cereal",
      price: 130,
      image: "/images/placeholders/drink.png",
    },
    // Smoothies & Lemonades
    {
      name: "Cheesecake Smoothie",
      description: "Lemon Square Cheesecake smoothie with mango bits",
      price: 130,
      image: "/images/placeholders/smoothie.png",
    },
    {
      name: "Lemonade",
      description: "Classic sweet and tangy lemonade.",
      price: 99,
      image: "/images/placeholders/lemonade.png",
    },
    {
      name: "Orange Lemonade",
      description: "Fresh lemonade infused with orange juice.",
      price: 120,
      image: "/images/placeholders/lemonade.png",
    },
    {
      name: "Strawberry Lemonade",
      description: "Fruity lemonade with strawberry puree.",
      price: 120,
      image: "/images/placeholders/lemonade.png",
    },
  ],
};
