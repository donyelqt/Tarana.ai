import { baguio_cathedral, baguio_panorama, baguio_public_market, bencab, botanicalbaguio, burnham, caferuins, campjohnhay, chimichanga_taranagala, diplomat_hotel, easter_weaving_room, goodsheperdconventbaguio, goodtaste, great_wall_of_baguio, hillstation, 
    ili_likha_baguio, 
    kapi_kullaaw, 
    lion_heads_baguio, 
    miradorheritageandecopark, 
    mt_kalugong, 
    mtulap, nightmarket, pma, smbaguio, tamawan, taranaai, the_mansion_baguio, treetopcampjohnhay, valley_of_colors, viewspark, 
    vizcossessionroad,
    wrightpark,
    yellow_trail} from "../../../../public";
  import { StaticImageData } from "next/image";
  import { Dices, Mountain, Utensils, Palette, ShoppingBag, Compass } from 'lucide-react';
  import React from "react";
  
  export {
  baguio_cathedral, baguio_panorama, bencab, botanicalbaguio, burnham, caferuins, 
  campjohnhay, goodtaste, hillstation, mtulap, nightmarket, smbaguio, tamawan, 
  taranaai, the_mansion_baguio, treetopcampjohnhay, viewspark, vizcossessionroad, wrightpark
};    
  
  export const budgetOptions = [
    "less than ₱3,000/day",
    "₱3,000 - ₱5,000/day",
    "₱5,000 - ₱10,000/day",
    "₱10,000+/day"
  ];
  
  export const paxOptions = ["1", "2", "3-5", "6+"];
  export const durationOptions = ["1 Day", "2 Days", "3 Days", "4-5 Days"];
  export const interests = [
    { label: "Random", icon: React.createElement(Dices, { "aria-label": "Random interest", size: 16 }) },
    { label: "Nature & Scenery", icon: React.createElement(Mountain, { "aria-label": "Nature & Scenery interest", size: 16 }) },
    { label: "Food & Culinary", icon: React.createElement(Utensils, { "aria-label": "Food & Culinary interest", size: 16 }) },
    { label: "Culture & Arts", icon: React.createElement(Palette, { "aria-label": "Culture & Arts interest", size: 16 }) },
    { label: "Shopping & Local Finds", icon: React.createElement(ShoppingBag, { "aria-label": "Shopping & Local Finds interest", size: 16 }) },
    { label: "Adventure", icon: React.createElement(Compass, { "aria-label": "Adventure interest", size: 16 }) }
  ];
  
  export interface Activity {
  image: StaticImageData | string; // Allow string for potential future API responses
  title: string;
  time: string;
  desc: string;
  tags: string[];
  peakHours?: string;
  relevanceScore?: number; // Optional relevance score from RAG results
}
  
  export interface ItinerarySection {
    period: string;
    activities: Activity[];
  }
  
  export interface ItineraryData {
    title: string;
    subtitle: string;
    items: ItinerarySection[];
  }
  
  // Enhanced sample itinerary data with detailed information for Google Gemini
  export const sampleItinerary: ItineraryData = {
    title: "Your 1 Day Itinerary",
    subtitle: "A personalized Baguio Experience",
    items: [
      {
        period: "Anytime",
        activities: [
            {
                image: burnham, 
                title: "Burnham Park",
                time: "24 Hours",
                desc: "Central park with a lake, boat rides, bike rentals, gardens, and open spaces. Entrance Fee: Free. Est. Duration: 1 Hour 30 Minutes. Best Day to visit: Weekdays (less crowded).",
                tags: ["Nature & Scenery", "Adventure", "Outdoor-Friendly", "Weather-Flexible"],
                peakHours: "10 am - 11 am / 4 pm - 6 pm",
            },
            {
                image: viewspark, 
                title: "Mines View Park",
                time: "6:00 AM – 8:00 PM",
                desc: "Scenic viewpoint overlooking Benguet’s mining towns; souvenir shops nearby. Entrance Fee: Free. Est. Duration: 45 Minutes. Best Day to visit: Weekdays (AM).",
                tags: ["Nature & Scenery", "Shopping & Local Finds", "Outdoor-Friendly"],
                peakHours: "6 am - 8 am / 5 pm - 6 pm",
            },
            {
                image: baguio_cathedral, 
                title: "Baguio Cathedral",
                time: "6:00 AM – 6:00 PM",
                desc: "Neo-Gothic cathedral with twin spires; offers panoramic city views. Entrance Fee: Free. Est. Duration: 45 Minutes. Best Day to visit: Sunday (AM).",
                tags: ["Culture & Arts", "Nature & Scenery", "Indoor-Friendly"],
                peakHours: "Saturday & Sunday 6 am - 5 pm",
            },
            {
                image: botanicalbaguio, 
                title: "Botanical Garden",
                time: "6:00 AM – 6:00 PM",
                desc: "Lush garden showcasing native plants and cultural sculptures. Entrance Fee: Free. Est. Duration: 1 Hour. Best Day to visit: Weekdays.",
                tags: ["Nature & Scenery", "Shopping & Local Finds", "Outdoor-Friendly", "Weather-Flexible"],
                peakHours: "10:00 am - 12:00 pm",
            },
            {
                image: the_mansion_baguio, 
                title: "The Mansion",
                time: "8:00 AM – 5:00 PM",
                desc: "Official summer residence of the Philippine President; features a grand gate and manicured lawns. Entrance Fee: Free. Est. Duration: 45 Minutes. Best Day to visit: Weekdays.",
                tags: ["Culture & Arts", "Nature & Scenery", "Outdoor-Friendly"],
                peakHours: "10:00 am - 12:00 pm",
            },
            {
                image: wrightpark, 
                title: "Wright Park",
                time: "6:00 AM – 6:00 PM",
                desc: "Tree-lined park with a reflecting pool; known for horseback riding. Entrance Fee: Free. Est. Duration: 1 Hour. Best Day to visit: Weekends (AM).",
                tags: ["Nature & Scenery", "Adventure", "Outdoor-Friendly"],
                peakHours: "10:00 am - 12:00 pm",
            },
            {
                image: campjohnhay, 
                title: "Camp John Hay",
                time: "8:00 AM – 5:00 PM",
                desc: "Former U.S. military base turned into a leisure complex with hotels, golf course, and trails. Entrance Fee: Free. Est. Duration: 2 Hours. Best Day to visit: Weekdays.",
                tags: ["Adventure", "Nature & Scenery", "Outdoor-Friendly", "Weather-Flexible"],
                peakHours: "6 am - 8 am / 4 pm - 6 pm",
            },
            {
                image: bencab,
                title: "Bencab Museum",
                time: "9:00 AM – 6:00 PM",
                desc: "Museum featuring works of national artist Benedicto Cabrera and indigenous artifacts. Entrance Fee: ₱150.00. Est. Duration: 1 Hour 30 Minutes. Best Day to visit: Weekdays.",
                tags: ["Culture & Arts", "Nature & Scenery", "Indoor-Friendly"],
                peakHours: "10:00 am - 12:00 pm",
            },
            {
                image: tamawan,
                title: "Tam-Awan Village",
                time: "9:00 AM – 6:00 PM",
                desc: "Reconstructed traditional Ifugao village showcasing Cordilleran culture and art. Entrance Fee: ₱60.00. Est. Duration: 1 Hour 30 Minutes. Best Day to visit: Saturday.",
                tags: ["Culture & Arts", "Adventure", "Weather-Flexible"],
                peakHours: "10:00 am - 12:00 pm",
            },
            {
                image: nightmarket,
                title: "Baguio Night Market",
                time: "9:00 PM – 2:00 AM",
                desc: "Evening market offering affordable clothes, accessories, and street food. Entrance Fee: Free. Est. Duration: 1 Hour 30 Minutes. Best Day to visit: Every Night.",
                tags: ["Shopping & Local Finds", "Food & Culinary", "Weather-Flexible"],
                peakHours: "9:00 pm - 10:00 pm",
            },
            {
                image: smbaguio,
                title: "SM City Baguio",
                time: "10:00 AM – 9:00 PM",
                desc: "Open-air mall with various retail stores, restaurants, and entertainment options. Entrance Fee: Free. Est. Duration: 2 Hours. Best Day to visit: Weekdays.",
                tags: ["Shopping & Local Finds", "Food & Culinary", "Indoor-Friendly"],
                peakHours: "Saturday & Sunday 6 am - 5 pm",
            },
            {
                image: baguio_public_market,
                title: "Baguio Public Market",
                time: "5:00 AM – 7:00 PM",
                desc: "Traditional market selling fresh produce, local delicacies, and handicrafts. Entrance Fee: Free. Est. Duration: 1 Hour. Best Day to visit: Weekdays.",
                tags: ["Shopping & Local Finds", "Food & Culinary", "Weather-Flexible", "Indoor-Friendly"],
                peakHours: "5 am - 7 am / 5 pm - 7 pm",
            },
            {
                image: goodsheperdconventbaguio,
                title: "Good Shepherd Convent",
                time: "8:00 AM – 5:00 PM",
                desc: "Known for its homemade ube jam and other local treats made by nuns. Entrance Fee: Free. Est. Duration: 45 Minutes. Best Day to visit: Weekdays (AM).",
                tags: ["Shopping & Local Finds", "Food & Culinary", "Indoor-Friendly"],
                peakHours: "1:00 pm - 3:00 pm",
            },
            {
                image: miradorheritageandecopark,
                title: "Mirador Heritage and Eco Park",
                time: "6:00 AM – 6:00 PM",
                desc: "Eco-park with trails, bamboo groves, and a peace memorial; offers city views. Entrance Fee: ₱100.00. Est. Duration: 1 Hour. Best Day to visit: Weekdays (PM).",
                tags: ["Nature & Scenery", "Culture & Arts", "Outdoor-Friendly"],
                peakHours: "7 am - 10 am / 5 pm - 6 pm",
            },
            {
                image: diplomat_hotel, 
                title: "Diplomat Hotel",
                time: "6:00 AM – 6:00 PM",
                desc: "Historic, abandoned hotel known for its architecture and ghost stories. Entrance Fee: Free. Est. Duration: 1 Hour. Best Day to visit: Weekdays (AM).",
                tags: ["Culture & Arts", "Nature & Scenery", "Outdoor-Friendly"],
                peakHours: "5:00 pm - 6:00 pm",
            },
            {
                image: lion_heads_baguio, 
                title: "Lions Head",
                time: "24 Hours",
                desc: "Iconic lion sculpture along Kennon Road; popular photo stop. Entrance Fee: Free. Est. Duration: 30 Minutes. Best Day to visit: Weekdays (PM).",
                tags: ["Nature & Scenery", "Culture & Arts", "Outdoor-Friendly"],
                peakHours: "5 am - 7 am / 8 pm - 10 pm",
            },
            {
                image: ili_likha_baguio, 
                title: "Ili-Likha Artists Village",
                time: "10:00 AM – 8:00 PM",
                desc: "Creative space featuring art installations, eco-friendly architecture, and local eateries. Entrance Fee: Free. Est. Duration: 1 Hour. Best Day to visit: Weekdays (PM).",
                tags: ["Culture & Arts", "Shopping & Local Finds", "Weather-Flexible"],
                peakHours: "12:00 pm - 3:00 pm",
            },
            {
                image: pma, 
                title: "Philippine Military Academy",
                time: "8:00 AM – 5:00 PM",
                desc: "Premier military school with a museum and ceremonial grounds open to visitors. Entrance Fee: Free. Est. Duration: 2 Hours. Best Day to visit: Weekdays.",
                tags: ["Culture & Arts", "Nature & Scenery", "Weather-Flexible"],
                peakHours: "8:00 am - 10:00 am",
            },
            {
                image: great_wall_of_baguio, 
                title: "Great wall of Baguio",
                time: "6:00 AM – 6:00 PM",
                desc: "Staircase resembling the Great Wall; offers panoramic views of the city mountains. Entrance Fee: Free. Est. Duration: 1 Hour. Best Day to visit: Weekdays (AM).",
                tags: ["Adventure", "Nature & Scenery", "Outdoor-Friendly"],
                peakHours: "10:00 am - 12:00 pm",
            },
            {
                image: yellow_trail,
                title: "Camp John Hay Yellow Trail",
                time: "8:00 AM - 6:00 PM",
                desc: "A scenic, easy trail in Camp John Hay, offering a refreshing walk among pine trees. Entrance Fee: Free. Est. Duration: 2 hours. Best Day to visit: Weekdays (AM).",
                tags: ["Adventure", "Nature & Scenery", "Outdoor-Friendly"],
                peakHours: "8:00 am - 10:00 pm",
            },
            {
                image: valley_of_colors,
                title: "Valley of Colors",
                time: "Anytime",
                desc: "A vibrant hillside community in La Trinidad near Baguio, where brightly colored houses form a striking mural. Entrance Fee: Free. Est. Duration: 15 minutes. Best Day to visit: Weekdays.",
                tags: ["Culture & Arts", "Nature & Scenery", "Outdoor-Friendly"],
                peakHours: "10:00 am - 11:00 am",
            },
            {
                image: easter_weaving_room, 
                title: "Easter Weaving Room",
                time: "8:00 AM - 5:00 PM",
                desc: "A historic center preserving Cordillera weaving, where visitors can watch artisans create handcrafted textiles. Entrance Fee: 150 - 200. Est. Duration: 1 Hour. Best Day to visit: Weekdays.",
                tags: ["Culture & Arts", "Shopping & Local Finds", "Indoor-Friendly"],
                peakHours: "10:00 am - 12:00 pm",
            },
            {
                image: mt_kalugong, 
                title: "Mt. Kalugong",
                time: "6:00 AM - 6:00 PM",
                desc: "Mt. Kalugong is a scenic limestone mountain in La Trinidad with stunning valley views and unique rock formations. Entrance Fee: 80 - 100. Est. Duration: 2 hours. Best Day to visit: Everyday.",
                tags: ["Nature & Scenery", "Adventure", "Outdoor-Friendly"],
                peakHours: "10 am - 12 pm / 4 pm - 6 pm",
            },
            {
                image: chimichanga_taranagala, 
                title: "Chimichanga by Jaimes Family Feast",
                time: "11:00 AM - 8:00 PM",
                desc: "A grill house known for its tender U.S. steaks, ribs, and generous family platters. Entrance Fee: Free. Est. Duration: 1 hour. Best Day to visit: Everyday.",
                tags: ["Food & Culinary", "Shopping & Local Finds", "Indoor-Friendly"],
                peakHours: "2 pm - 3 pm",
            },
            {
                image: kapi_kullaaw, 
                title: "Kapi Kullaaw",
                time: "10:00 AM - 7:00 PM",
                desc: "An artsy café tucked inside Ili-Likha Artists' Village, serving coffee with a creative twist. Entrance Fee: Free. Est. Duration: 1 hour 30 minutes. Best Day to visit: Weekdays.",
                tags: ["Food & Culinary", "Culture & Arts", "Weather-Flexible", "Indoor-Friendly"],
                peakHours: "4 pm - 6 pm",
            },
            {
                image: "/images/placeholders/food-placeholder.jpg", 
                title: "Itaewon Cafe",
                time: "9:00 AM - 11:00 PM",
                desc: "A Korean-themed café with minimalist interiors and K-drama vibes perfect for café hoppers. Entrance Fee: Free. Est. Duration: 1 hour 30 minutes. Best Day to visit: Weekdays.",
                tags: ["Food & Culinary", "Shopping & Local Finds", "Weather-Flexible", "Indoor-Friendly"],
                peakHours: "4 pm - 7 pm",
            },
            {
                image: "/images/placeholders/food-placeholder.jpg", 
                title: "Agara Ramen",
                time: "11:00 AM - 10:00 PM",
                desc: "A crowd-favorite ramen shop serving rich, flavorful bowls of authentic Japanese comfort food. Entrance Fee: Free. Est. Duration: 2 hours. Best Day to visit: Weekdays.",
                tags: ["Food & Culinary", "Shopping & Local Finds", "Weather-Flexible", "Indoor-Friendly"],
                peakHours: "6 pm - 8 pm",
            },
            {
                image: "/images/placeholders/food-placeholder.jpg", 
                title: "KoCo Cafe",
                time: "7:00 AM - 10:00 PM",
                desc: "A stylish and Instagram-worthy café loved for its cozy vibes and quality coffee. Entrance Fee: Free. Est. Duration: 1 hour 30 minutes. Best Day to visit: Weekdays.",
                tags: ["Food & Culinary", "Shopping & Local Finds", "Weather-Flexible", "Indoor-Friendly"],
                peakHours: "3 pm - 5 pm",
            },
            {
                image: "/images/placeholders/food-placeholder.jpg", 
                title: "Good Sheperd Cafe",
                time: "6:00 AM - 7:30 PM",
                desc: "A quaint café near the famous convent, known for local delicacies and scenic views. Entrance Fee: Free. Est. Duration: 1 hour. Best Day to visit: Weekdays.",
                tags: ["Food & Culinary", "Shopping & Local Finds", "Weather-Flexible", "Indoor-Friendly"],
                peakHours: "4 pm - 6 pm",
            },
            {
                image: "/images/placeholders/food-placeholder.jpg", 
                title: "Tavern Cafe",
                time: "9:00 AM - 10:00 PM",
                desc: "A casual dining café that offers a mix of comfort food and relaxed ambiance. Entrance Fee: Free. Est. Duration: 1 hour. Best Day to visit: Weekdays.",
                tags: ["Food & Culinary", "Nature & Scenery", "Weather-Flexible", "Indoor-Friendly"],
                peakHours: "4 pm - 6 pm",
            },
            {
                image: "/images/placeholders/food-placeholder.jpg", 
                title: "Oh My Gulay",
                time: "11:00 AM - 8:00 PM",
                desc: "A whimsical vegetarian restaurant and art space serving creative plant-based dishes. Entrance Fee: Free. Est. Duration: 1 hour. Best Day to visit: Weekdays.",
                tags: ["Food & Culinary", "Nature & Scenery", "Weather-Flexible", "Indoor-Friendly"],
                peakHours: "2 pm - 5 pm",
            },
            {
                image: "/images/placeholders/food-placeholder.jpg", 
                title: "Hill Station",
                time: "7:00 AM - 10:00 PM",
                desc: "An elegant colonial-style restaurant offering fusion dishes and cozy mountain charm. Entrance Fee: Free. Est. Duration: 1 hour. Best Day to visit: Weekdays.",
                tags: ["Food & Culinary", "Nature & Scenery", "Weather-Flexible", "Indoor-Friendly"],
                peakHours: "7 am - 9 am",
            },
            {
                image: "/images/placeholders/food-placeholder.jpg", 
                title: "Hiraya Cafe",
                time: "9:00 AM - 8:00 PM",
                desc: "A tranquil café with dreamy aesthetics, perfect for quiet reflection or creative work. Entrance Fee: Free. Est. Duration: 1 hour 30 minutes. Best Day to visit: Weekdays.",
                tags: ["Food & Culinary", "Shopping & Local Finds", "Weather-Flexible", "Indoor-Friendly"],
                peakHours: "9 am - 11 am",
            },
            {
                image: "/images/placeholders/food-placeholder.jpg", 
                title: "Uji-Matcha Cafe",
                time: "7:30 AM - 11:30 PM",
                desc: "A Japanese-inspired café specializing in matcha drinks and desserts. Entrance Fee: Free. Est. Duration: 1 hour 30 minutes. Best Day to visit: Weekdays.",
                tags: ["Food & Culinary", "Shopping & Local Finds", "Weather-Flexible", "Indoor-Friendly"],
                peakHours: "4 pm - 7 pm",
            },
            {
                image: "/images/placeholders/food-placeholder.jpg", 
                title: "K-Flavors Buffet",
                time: "10:00 AM - 12:00 AM",
                desc: "An affordable Korean buffet offering unlimited meats and side dishes in a lively setting. Entrance Fee: Free. Est. Duration: 2 hours 30 minutes. Best Day to visit: Weekdays.",
                tags: ["Food & Culinary", "Shopping & Local Finds", "Weather-Flexible", "Indoor-Friendly"],
                peakHours: "12 pm - 5 pm",
            },
            {
                image: "/images/placeholders/food-placeholder.jpg", 
                title: "Korean Palace Kung Jeon",
                time: "10:00 AM - 10:00 PM",
                desc: "A popular Korean barbecue buffet with a wide variety of meats and banchan. Entrance Fee: Free. Est. Duration: 2 hours 30 minutes. Best Day to visit: Weekdays.",
                tags: ["Food & Culinary", "Shopping & Local Finds", "Weather-Flexible", "Indoor-Friendly"],
                peakHours: "12 pm - 5 pm",
            },
            {
                image: "/images/placeholders/food-placeholder.jpg", 
                title: "Myeong Dong Jjigae Restaurant",
                time: "10:30 AM - 9:00 PM",
                desc: "A Korean buffet restaurant known for its unlimited jjigae, barbecue, and hotpot options. Entrance Fee: Free. Est. Duration: 2 hours 30 minutes. Best Day to visit: Weekdays.",
                tags: ["Food & Culinary", "Shopping & Local Finds", "Weather-Flexible", "Indoor-Friendly"],
                peakHours: "11 am - 1 pm",
            }
        ]
      }
    ]
  };
  
  export const sampleItineraryCombined: ItineraryData = {
    title: sampleItinerary.title,
    subtitle: sampleItinerary.subtitle,
    items: [
      {
        period: "Anytime",
        activities: sampleItinerary.items.flatMap(section => section.activities)
      }
    ]
  };
  
  export const taranaai_icon = taranaai; // Exporting for the placeholder in preview