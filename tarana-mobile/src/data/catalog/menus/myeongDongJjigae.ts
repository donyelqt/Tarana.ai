// ====================================================================
// MYEONG DONG JJIGAE RESTAURANT MENU DATA
// ====================================================================

import { FullMenu } from "../types";

export const myeongDongJjigaeMenu: FullMenu = {
  Breakfast: [],
  Lunch: [
    {
      name: "Myeongdong Set A",
      description: "Buffet Only",
      price: 399,
      image: "/images/comingsoon.png",
    },
    {
      name: "Myeongdong Set B",
      description: "Buffet with Samgyeopsal",
      price: 599,
      image: "/images/comingsoon.png",
    },
    {
      name: "Myeongdong Set C",
      description: "Buffet with Hotpot/Jjigae",
      price: 599,
      image: "/images/comingsoon.png",
    },
    {
      name: "Myeongdong Set D",
      description: "All-in-Buffet with Samgyeopsal and Jjigae",
      price: 699,
      image: "/images/comingsoon.png",
    },
  ],
  Dinner: [],
  Snacks: [],
  Drinks: [],
};