// ====================================================================
// SOM TAM THAI RESTAURANT MENU DATA
// ====================================================================
// Som Tam Thai Restaurant in Baguio offers a vibrant, authentic taste of Thailand 
// with their signature papaya salad, flavorful stir-fries, aromatic curries, 
// and refreshing beverages, all crafted with fresh, local ingredients.
// ====================================================================

import { FullMenu } from "../types";

export const somTamThaiRestaurantMenu: FullMenu = {
  Breakfast: [],
  Lunch: [
    // Noodles
    {
      name: "Pad Thai (Stir-Fried Noodles)",
      description: "Classic Thai rice noodles stir-fried with egg, tofu, bean sprouts, and peanuts.",
      price: 220,
      image: "/images/placeholders/noodles.png",
    },
    {
      name: "Pad Thai Gai",
      description: "Stir-fried Pad Thai noodles topped with tender chicken.",
      price: 220,
      image: "/images/placeholders/noodles.png",
    },
    {
      name: "Pad Thai Talay",
      description: "Pad Thai noodles with mixed seafood.",
      price: 280,
      image: "/images/placeholders/noodles.png",
    },
    {
      name: "Tom Yum Gai w/ Rice Noodle",
      description: "Spicy-sour chicken tom yum broth served with rice noodles.",
      price: 280,
      image: "/images/placeholders/soup.png",
    },
    {
      name: "Tom Yum Goong w/ Rice Noodle",
      description: "Shrimp tom yum soup with rice noodles.",
      price: 320,
      image: "/images/placeholders/soup.png",
    },
    {
      name: "Kao Soi (Curry Noodle Soup)",
      description: "Northern Thai curry noodle soup topped with crispy noodles.",
      price: 280,
      image: "/images/placeholders/soup.png",
    },
    // Fried Rice
    {
      name: "Kao Pad Gai (Chicken Fried Rice)",
      description: "Fragrant Thai-style fried rice with chicken.",
      price: 180,
      image: "/images/placeholders/rice.png",
    },
    {
      name: "Kao Pad Moo (Pork Fried Rice)",
      description: "Thai fried rice with savory pork.",
      price: 180,
      image: "/images/placeholders/rice.png",
    },
    {
      name: "Kao Pad Nua (Beef Fried Rice)",
      description: "Thai fried rice with tender beef slices.",
      price: 180,
      image: "/images/placeholders/rice.png",
    },
    {
      name: "Kao kluk Kapi (Bagoong Rice)",
      description: "Shrimp paste fried rice served with toppings.",
      price: 280,
      image: "/images/placeholders/rice.png",
    },
    {
      name: "Kao Pad Goong (Shrimp Fried Rice)",
      description: "Fried rice with plump shrimp.",
      price: 200,
      image: "/images/placeholders/rice.png",
    },
    {
      name: "Kao Pad Saparod (Pineapple Fried Rice)",
      description: "Sweet and savory rice fried with pineapple chunks.",
      price: 250,
      image: "/images/placeholders/rice.png",
    },
    {
      name: "Kao Pad poo (Crab Fried Rice)",
      description: "Fluffy fried rice with crab meat.",
      price: 220,
      image: "/images/placeholders/rice.png",
    },
    {
      name: "A cup of Plain Rice",
      description: "Steamed white rice.",
      price: 30,
      image: "/images/placeholders/rice.png",
    },
    // Chicken Dishes
    {
      name: "Krapow Gai (Stir-fried Chicken)",
      description: "Minced chicken stir-fried with Thai basil and chili.",
      price: 180,
      image: "/images/placeholders/chicken.png",
    },
    {
      name: "Gai Hor Bai Toey (Chicken Pandan)",
      description: "Marinated chicken wrapped in pandan leaves and fried.",
      price: 200,
      image: "/images/placeholders/chicken.png",
    },
    {
      name: "Thai Fried Chicken",
      description: "Crispy fried chicken Thai-style.",
      price: 180,
      image: "/images/placeholders/chicken.png",
    },
    {
      name: "Gai Thod",
      description: "Thai deep-fried chicken served with dipping sauce.",
      price: 220,
      image: "/images/placeholders/chicken.png",
    },
    {
      name: "Sate Gai (Chicken Sate)",
      description: "Grilled marinated chicken skewers with peanut sauce.",
      price: 180,
      image: "/images/placeholders/chicken.png",
    },
    // Chicken Curries
    {
      name: "Kaeng Kiew Liew Gai (Chicken in Red Curry)",
      description: "Chicken simmered in spicy red curry.",
      price: 200,
      image: "/images/placeholders/curry.png",
    },
    {
      name: "Kaeng Kiew Wan Gai (Chicken in Green Curry)",
      description: "Fragrant green curry with chicken and vegetables.",
      price: 200,
      image: "/images/placeholders/curry.png",
    },
    {
      name: "Kaeng Kari Gai (Chicken in Yellow Curry)",
      description: "Mild yellow curry with chicken and coconut milk.",
      price: 200,
      image: "/images/placeholders/curry.png",
    },
    // Vegetable Dishes
    {
      name: "Thao Lan Tao (Stir-fried Snow Peas)",
      description: "Crisp snow peas stir-fried with garlic and oyster sauce.",
      price: 180,
      image: "/images/placeholders/vegetables.png",
    },
    {
      name: "Pad Pak Ruam mit (Stir-fried Mixed Veggies)",
      description: "Colorful seasonal vegetables stir-fried in light sauce.",
      price: 180,
      image: "/images/placeholders/vegetables.png",
    },
    {
      name: "Pakboong",
      description: "Stir-fried water spinach (kangkong) with garlic and soy.",
      price: 160,
      image: "/images/placeholders/vegetables.png",
    },
    {
      name: "Tofu Curry",
      description: "Silky tofu cooked in rich Thai curry sauce.",
      price: 200,
      image: "/images/placeholders/tofu.png",
    },
    // Seafood Dishes
    {
      name: "Pla Som Rod",
      description: "Crispy fried fish topped with sweet and sour chili sauce.",
      price: 250,
      image: "/images/placeholders/fish.png",
    },
    {
      name: "Krapow Talay (Stir-fried Seafood)",
      description: "Mixed seafood stir-fried with basil and chili.",
      price: 300,
      image: "/images/placeholders/seafood.png",
    },
    // Beef Dishes
    {
      name: "Kaeng Kiew Wan Nua (Beef in Green Curry)",
      description: "Tender beef in aromatic green curry.",
      price: 250,
      image: "/images/placeholders/curry.png",
    },
    {
      name: "Kaeng Kiew Liew Nua (Beef in Red Curry)",
      description: "Rich red curry with slices of beef.",
      price: 250,
      image: "/images/placeholders/curry.png",
    },
    {
      name: "Kaeng Kari Nua (Beef in Yellow Curry)",
      description: "Creamy yellow curry with beef.",
      price: 250,
      image: "/images/placeholders/curry.png",
    },
    {
      name: "Krapow Nua (Stir-fried beef w/ Basil)",
      description: "Beef stir-fried with Thai basil and chili.",
      price: 250,
      image: "/images/placeholders/beef.png",
    },
    // Pork Dishes
    {
      name: "Pad Prik Khing Moo Krob (Crispy Pork in Red Curry)",
      description: "Crispy pork stir-fried in red curry paste.",
      price: 250,
      image: "/images/placeholders/pork.png",
    },
    {
      name: "Moo Ping (Pork Barbeque Skewer)",
      description: "Thai-style grilled pork skewers.",
      price: 200,
      image: "/images/placeholders/pork.png",
    },
    {
      name: "Krapow Moo (Stir-fried Pork w/ Basil)",
      description: "Pork stir-fried with basil, chili, and garlic.",
      price: 180,
      image: "/images/placeholders/pork.png",
    },
    {
      name: "Moo Grob (Crispy Pork w/ Cucumber Salad)",
      description: "Crunchy pork belly with refreshing cucumber salad.",
      price: 200,
      image: "/images/placeholders/pork.png",
    },
    // Soups
    {
      name: "Tom Yum Goong (Shrimp)",
      description: "Spicy and sour shrimp soup with lemongrass and herbs.",
      price: 280,
      image: "/images/placeholders/soup.png",
    },
    {
      name: "Tom Yum Gai (Chicken)",
      description: "Tom yum soup with chicken.",
      price: 240,
      image: "/images/placeholders/soup.png",
    },
    {
      name: "Tom Yum Talay (Sea Food)",
      description: "Hot and sour soup with mixed seafood.",
      price: 340,
      image: "/images/placeholders/soup.png",
    },
    // Salads
    {
      name: "Som Tam (Papaya Salad)",
      description: "Spicy green papaya salad with peanuts.",
      price: 150,
      image: "/images/placeholders/salad.png",
    },
    {
      name: "Som Tam with Salted Egg",
      description: "Papaya salad served with salted egg slices.",
      price: 180,
      image: "/images/placeholders/salad.png",
    },
    {
      name: "Yam Som-O (Pomelo Salad)",
      description: "Sweet and tangy pomelo salad with Thai dressing.",
      price: 240,
      image: "/images/placeholders/salad.png",
    },
    {
      name: "Yam Pla Duk Foo (Crispy Catfish w/ Mango Salad)",
      description: "Crispy catfish flakes served with tangy mango salad.",
      price: 200,
      image: "/images/placeholders/fish.png",
    },
  ],
  Dinner: [
    // Noodles
    {
      name: "Pad Thai (Stir-Fried Noodles)",
      description: "Classic Thai rice noodles stir-fried with egg, tofu, bean sprouts, and peanuts.",
      price: 220,
      image: "/images/placeholders/noodles.png",
    },
    {
      name: "Pad Thai Gai",
      description: "Stir-fried Pad Thai noodles topped with tender chicken.",
      price: 220,
      image: "/images/placeholders/noodles.png",
    },
    {
      name: "Pad Thai Talay",
      description: "Pad Thai noodles with mixed seafood.",
      price: 280,
      image: "/images/placeholders/noodles.png",
    },
    {
      name: "Tom Yum Gai w/ Rice Noodle",
      description: "Spicy-sour chicken tom yum broth served with rice noodles.",
      price: 280,
      image: "/images/placeholders/soup.png",
    },
    {
      name: "Tom Yum Goong w/ Rice Noodle",
      description: "Shrimp tom yum soup with rice noodles.",
      price: 320,
      image: "/images/placeholders/soup.png",
    },
    {
      name: "Kao Soi (Curry Noodle Soup)",
      description: "Northern Thai curry noodle soup topped with crispy noodles.",
      price: 280,
      image: "/images/placeholders/soup.png",
    },
    // Fried Rice
    {
      name: "Kao Pad Gai (Chicken Fried Rice)",
      description: "Fragrant Thai-style fried rice with chicken.",
      price: 180,
      image: "/images/placeholders/rice.png",
    },
    {
      name: "Kao Pad Moo (Pork Fried Rice)",
      description: "Thai fried rice with savory pork.",
      price: 180,
      image: "/images/placeholders/rice.png",
    },
    {
      name: "Kao Pad Nua (Beef Fried Rice)",
      description: "Thai fried rice with tender beef slices.",
      price: 180,
      image: "/images/placeholders/rice.png",
    },
    {
      name: "Kao kluk Kapi (Bagoong Rice)",
      description: "Shrimp paste fried rice served with toppings.",
      price: 280,
      image: "/images/placeholders/rice.png",
    },
    {
      name: "Kao Pad Goong (Shrimp Fried Rice)",
      description: "Fried rice with plump shrimp.",
      price: 200,
      image: "/images/placeholders/rice.png",
    },
    {
      name: "Kao Pad Saparod (Pineapple Fried Rice)",
      description: "Sweet and savory rice fried with pineapple chunks.",
      price: 250,
      image: "/images/placeholders/rice.png",
    },
    {
      name: "Kao Pad poo (Crab Fried Rice)",
      description: "Fluffy fried rice with crab meat.",
      price: 220,
      image: "/images/placeholders/rice.png",
    },
    {
      name: "A cup of Plain Rice",
      description: "Steamed white rice.",
      price: 30,
      image: "/images/placeholders/rice.png",
    },
    // Chicken Dishes
    {
      name: "Krapow Gai (Stir-fried Chicken)",
      description: "Minced chicken stir-fried with Thai basil and chili.",
      price: 180,
      image: "/images/placeholders/chicken.png",
    },
    {
      name: "Gai Hor Bai Toey (Chicken Pandan)",
      description: "Marinated chicken wrapped in pandan leaves and fried.",
      price: 200,
      image: "/images/placeholders/chicken.png",
    },
    {
      name: "Thai Fried Chicken",
      description: "Crispy fried chicken Thai-style.",
      price: 180,
      image: "/images/placeholders/chicken.png",
    },
    {
      name: "Gai Thod",
      description: "Thai deep-fried chicken served with dipping sauce.",
      price: 220,
      image: "/images/placeholders/chicken.png",
    },
    {
      name: "Sate Gai (Chicken Sate)",
      description: "Grilled marinated chicken skewers with peanut sauce.",
      price: 180,
      image: "/images/placeholders/chicken.png",
    },
    // Chicken Curries
    {
      name: "Kaeng Kiew Liew Gai (Chicken in Red Curry)",
      description: "Chicken simmered in spicy red curry.",
      price: 200,
      image: "/images/placeholders/curry.png",
    },
    {
      name: "Kaeng Kiew Wan Gai (Chicken in Green Curry)",
      description: "Fragrant green curry with chicken and vegetables.",
      price: 200,
      image: "/images/placeholders/curry.png",
    },
    {
      name: "Kaeng Kari Gai (Chicken in Yellow Curry)",
      description: "Mild yellow curry with chicken and coconut milk.",
      price: 200,
      image: "/images/placeholders/curry.png",
    },
    // Vegetable Dishes
    {
      name: "Thao Lan Tao (Stir-fried Snow Peas)",
      description: "Crisp snow peas stir-fried with garlic and oyster sauce.",
      price: 180,
      image: "/images/placeholders/vegetables.png",
    },
    {
      name: "Pad Pak Ruam mit (Stir-fried Mixed Veggies)",
      description: "Colorful seasonal vegetables stir-fried in light sauce.",
      price: 180,
      image: "/images/placeholders/vegetables.png",
    },
    {
      name: "Pakboong",
      description: "Stir-fried water spinach (kangkong) with garlic and soy.",
      price: 160,
      image: "/images/placeholders/vegetables.png",
    },
    {
      name: "Tofu Curry",
      description: "Silky tofu cooked in rich Thai curry sauce.",
      price: 200,
      image: "/images/placeholders/tofu.png",
    },
    // Seafood Dishes
    {
      name: "Pla Som Rod",
      description: "Crispy fried fish topped with sweet and sour chili sauce.",
      price: 250,
      image: "/images/placeholders/fish.png",
    },
    {
      name: "Krapow Talay (Stir-fried Seafood)",
      description: "Mixed seafood stir-fried with basil and chili.",
      price: 300,
      image: "/images/placeholders/seafood.png",
    },
    // Beef Dishes
    {
      name: "Kaeng Kiew Wan Nua (Beef in Green Curry)",
      description: "Tender beef in aromatic green curry.",
      price: 250,
      image: "/images/placeholders/curry.png",
    },
    {
      name: "Kaeng Kiew Liew Nua (Beef in Red Curry)",
      description: "Rich red curry with slices of beef.",
      price: 250,
      image: "/images/placeholders/curry.png",
    },
    {
      name: "Kaeng Kari Nua (Beef in Yellow Curry)",
      description: "Creamy yellow curry with beef.",
      price: 250,
      image: "/images/placeholders/curry.png",
    },
    {
      name: "Krapow Nua (Stir-fried beef w/ Basil)",
      description: "Beef stir-fried with Thai basil and chili.",
      price: 250,
      image: "/images/placeholders/beef.png",
    },
    // Pork Dishes
    {
      name: "Pad Prik Khing Moo Krob (Crispy Pork in Red Curry)",
      description: "Crispy pork stir-fried in red curry paste.",
      price: 250,
      image: "/images/placeholders/pork.png",
    },
    {
      name: "Moo Ping (Pork Barbeque Skewer)",
      description: "Thai-style grilled pork skewers.",
      price: 200,
      image: "/images/placeholders/pork.png",
    },
    {
      name: "Krapow Moo (Stir-fried Pork w/ Basil)",
      description: "Pork stir-fried with basil, chili, and garlic.",
      price: 180,
      image: "/images/placeholders/pork.png",
    },
    {
      name: "Moo Grob (Crispy Pork w/ Cucumber Salad)",
      description: "Crunchy pork belly with refreshing cucumber salad.",
      price: 200,
      image: "/images/placeholders/pork.png",
    },
    // Soups
    {
      name: "Tom Yum Goong (Shrimp)",
      description: "Spicy and sour shrimp soup with lemongrass and herbs.",
      price: 280,
      image: "/images/placeholders/soup.png",
    },
    {
      name: "Tom Yum Gai (Chicken)",
      description: "Tom yum soup with chicken.",
      price: 240,
      image: "/images/placeholders/soup.png",
    },
    {
      name: "Tom Yum Talay (Sea Food)",
      description: "Hot and sour soup with mixed seafood.",
      price: 340,
      image: "/images/placeholders/soup.png",
    },
    // Salads
    {
      name: "Som Tam (Papaya Salad)",
      description: "Spicy green papaya salad with peanuts.",
      price: 150,
      image: "/images/placeholders/salad.png",
    },
    {
      name: "Som Tam with Salted Egg",
      description: "Papaya salad served with salted egg slices.",
      price: 180,
      image: "/images/placeholders/salad.png",
    },
    {
      name: "Yam Som-O (Pomelo Salad)",
      description: "Sweet and tangy pomelo salad with Thai dressing.",
      price: 240,
      image: "/images/placeholders/salad.png",
    },
    {
      name: "Yam Pla Duk Foo (Crispy Catfish w/ Mango Salad)",
      description: "Crispy catfish flakes served with tangy mango salad.",
      price: 200,
      image: "/images/placeholders/fish.png",
    },
  ],
  Snacks: [],
  Drinks: [],
};
