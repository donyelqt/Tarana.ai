import { MenuItem } from "@/types/tarana-eats";

// Static sample menu data
export const MENU_DATA: Record<string, MenuItem[]> = {
  "Hill Station": [
    {
      name: "Beef Pares",
      description: "Tender beef stew with garlic rice.",
      price: 150,
      image: "/images/bencab.png",
    },
    {
      name: "Kapeng Barako",
      description: "Strong local coffee blend.",
      price: 55,
      image: "/images/caferuins.png",
    },
    {
      name: "Pinikpikan Bowl",
      description: "Traditional Cordilleran chicken soup.",
      price: 180,
      image: "/images/goodtaste.png",
    },
  ],
  "Itaewon Cafe": [
    {
      name: "Bibimbap",
      description: "Korean mixed rice with vegetables and meat.",
      price: 200,
      image: "/images/itaewon.png",
    },
    {
      name: "Tteokbokki",
      description: "Spicy Korean rice cakes.",
      price: 120,
      image: "/images/itaewon.png",
    },
  ],
}; 