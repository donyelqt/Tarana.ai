import { baguio_panorama, bencab, burnham, caferuins, goodtaste, hillstation, 
  mtulap, nightmarket, tamawan, taranaai, treetopcampjohnhay, viewspark, 
  vizcossessionroad} from "../../../../public";
import { StaticImageData } from "next/image";
import { Dices, Mountain, Utensils, Palette, ShoppingBag, Compass } from 'lucide-react';
import React from "react";

export {
  baguio_panorama, bencab, burnham, caferuins, goodtaste, hillstation,
  mtulap, nightmarket, tamawan, taranaai, treetopcampjohnhay, viewspark,
  vizcossessionroad
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
          image: goodtaste,
          title: "Breakfast at Good Taste Restaurant",
          time: "7:30AM-9:00AM",
          desc: "Fuel up with a hearty Filipino-Chinese breakfast at Good Taste, a Baguio favorite known for generous portions and affordable prices. Try their famous buttered chicken (₱180-250) and pancit canton (₱150-200). Located at Carino St., this 24-hour restaurant is perfect for early risers. Budget-friendly with meals averaging ₱150-300 per person. Travel time from city center: 5-10 minutes by taxi (₱70-100).",
          tags: ["Food & Culinary", "Budget-friendly", "Local Favorite", "Indoor-Friendly"]
        },
        {
          image: burnham,
          title: "Burnham Park Activities",
          time: "9:15AM-11:00AM",
          desc: "Enjoy boating on the man-made lake (₱150/hour) or rent a bike (₱60-100/hour) to tour this historic park at the heart of the city. The rose garden and orchidarium are perfect for nature lovers. Street food vendors offer affordable snacks (₱20-50). Located at the city center, it's easily accessible by walking from most downtown hotels. Duration: 1.5-2 hours including walking around. Perfect for both sunny and cloudy weather.",
          tags: ["Nature & Scenery", "Adventure", "Budget-friendly", "Family-friendly", "Outdoor-Friendly"]
        },
        {
          image: bencab,
          title: "BenCab Museum Visit",
          time: "9:30AM-12:00PM",
          desc: "Explore the works of National Artist Benedicto Cabrera at this world-class museum featuring Filipino art, indigenous artifacts, and a serene garden with duck ponds and eco-trail. Entrance fee: ₱150 (adults), ₱120 (students). Located in Tuba, Benguet, about 15-20 minutes from city center by taxi (₱200-250). The on-site Café Sabel offers farm-to-table dishes (₱250-450) with ingredients from their own garden. Perfect indoor activity for rainy days. Duration: 2-2.5 hours including garden walk.",
          tags: ["Culture & Arts", "Museum", "Indoor-Friendly", "Mid-range Budget", "Educational"]
        },
        {
          image: mtulap,
          title: "Mt. Ulap Eco-Trail (Half-Day Hike)",
          time: "8:00AM-12:30PM",
          desc: "Experience this popular day hike on the Ampucao-Sta Fe ridge with stunning views of the Cordillera mountains. Visit highlights like Gungal Rock and Ambanao Paoay Peak. Guide fee: ₱600 + ₱100/person. Transportation: Jeepney from Baguio (₱30) or taxi (₱350-400). Duration: 4-5 hours for the beginner trail. Difficulty: Moderate. Best during clear weather. Bring: 1L water, trail snacks, sunscreen, hat, light jacket. Not recommended during rainy season due to slippery trails.",
          tags: ["Nature & Scenery", "Adventure", "Hiking", "Outdoor-Friendly", "Physical Activity", "Clear Weather Only"]
        }
      ]
    },
    {
      period: "Anytime",
      activities: [
        {
          image: hillstation,
          title: "Lunch at Hill Station",
          time: "12:45PM-2:00PM",
          desc: "Enjoy international cuisine with a Filipino twist at this award-winning restaurant located in Casa Vallejo, a historic hotel built in 1909. Known for its cozy ambiance and historic setting. Try their US Angus Beef Salpicao (₱650) or Cordillera Chicken Roulade (₱450). Reservation recommended. Price range: ₱450-800 per person. Located at Upper Session Road, 5-minute walk from SM Baguio. Perfect for any weather condition. Duration: 1-1.5 hours for a leisurely meal.",
          tags: ["Food & Culinary", "Fine Dining", "Historic Site", "Indoor-Friendly", "High-end Budget"]
        },
        {
          image: tamawan,
          title: "Tam-awan Village Cultural Experience",
          time: "2:30PM-4:30PM",
          desc: "Immerse yourself in Cordilleran culture at this reconstructed indigenous village featuring traditional Ifugao and Kalinga huts, art galleries, and cultural workshops. Enjoy scenic viewpoints and local crafts. Entrance fee: ₱60 (adults), ₱50 (students). Art workshops available (₱250-500). Located in Pinsao Proper, 15-20 minutes from city center by taxi (₱150-200). Has covered walkways between huts, making it suitable for light rain. Duration: 1.5-2 hours for a complete tour. Cultural performances on weekends (additional ₱100).",
          tags: ["Culture & Arts", "Local Heritage", "Shopping & Local Finds", "Educational", "Weather-Flexible", "Mid-range Budget"]
        },
        {
          image: treetopcampjohnhay,
          title: "Tree Top Adventure at Camp John Hay",
          time: "4:45PM-6:00PM",
          desc: "Experience thrilling activities like the Superman Ride (₱300), Canopy Ride (₱250), or Silver Surfer (₱200). Perfect for adventure seekers looking for an adrenaline rush. Located in Camp John Hay Special Economic Zone, 10-15 minutes from city center by taxi (₱120-150). Package deals available: ₱650 for 3 rides. Height and weight restrictions apply. Not operational during heavy rain or strong winds. Duration: 1-1.5 hours for multiple activities. Last ride usually at 5:30PM.",
          tags: ["Nature & Scenery", "Adventure", "Adrenaline & Extreme", "Outdoor-Friendly", "Mid-range Budget", "Clear Weather Only"]
        },
        {
          image: viewspark,
          title: "Mines View Park Scenic Overlook",
          time: "3:00PM-4:30PM",
          desc: "Visit this famous lookout point offering panoramic views of the Cordillera mountains and the abandoned gold and copper mines. Entrance is free. Souvenir shops and food stalls line the approach to the park. Try on traditional Igorot attire for photos (₱20-50). Sample strawberry taho (₱30-50) or fresh strawberries when in season. Located 15-20 minutes from city center by jeepney (₱10) or taxi (₱120-150). Best visited on clear days for optimal views. Duration: 1-1.5 hours including shopping. Crowded on weekends and holidays.",
          tags: ["Nature & Scenery", "Shopping & Local Finds", "Photography Spot", "Budget-friendly", "Outdoor-Friendly", "Family-friendly"]
        }
      ]
    },
    {
      period: "Anytime",
      activities: [
        {
          image: caferuins,
          title: "Dinner at Café by the Ruins",
          time: "6:30PM-8:00PM",
          desc: "Experience farm-to-table dining at this iconic Baguio restaurant located at 25 Shuntug Road (across City Hall). Founded by artists in the 1980s, it's built on actual ruins of a historic building. Try their signature dishes made with locally-sourced ingredients - from Warm Shiitake Salad (₱280) to Pasta Carbonara (₱240). Don't miss their famous Camote Bread (₱100) with homemade spreads. Average meal cost: ₱350-500 per person. Reservation recommended on weekends. Open daily from 7AM to 9PM. Duration: 1.5 hours for a relaxed dinner. Indoor seating available for rainy evenings.",
          tags: ["Food & Culinary", "Culture & Arts", "Local Heritage", "Indoor-Friendly", "Mid-range Budget", "Romantic"]
        },
        {
          image: nightmarket,
          title: "Night Market on Harrison Road",
          time: "9:00PM-11:00PM",
          desc: "End your day at the vibrant Night Market along Harrison Road near Burnham Park (open 9PM-2AM). Find ukay-ukay (thrift clothes) for ₱50-250, local handicrafts, souvenirs, and delicious street food. Enjoy Filipino street food like fishballs (₱15), isaw (₱15), and sisig rice meals (₱60-80), or try the popular strawberry taho (₱25-35). Bring small bills and be prepared to haggle. Located at the city center, easily accessible by walking from most downtown hotels. Not recommended during heavy rain as it's an open-air market. Duration: 1-2 hours for shopping and snacking. Security is present but watch your belongings in crowds.",
          tags: ["Shopping & Local Finds", "Food & Culinary", "Budget-friendly", "Local Experience", "Night Activity", "Weather-Dependent"]
        },
        {
          image: vizcossessionroad,
          title: "Dessert at Vizco's Restaurant & Cake Shop",
          time: "8:15PM-9:30PM",
          desc: "Satisfy your sweet tooth at this famous Baguio bakery known for their signature strawberry shortcake (₱120/slice, ₱650 whole). Also try their blueberry cheesecake (₱130/slice) or ube cake (₱110/slice). Located at Session Road, 5-minute walk from Burnham Park. Also serves meals (₱180-350) if you prefer a full dinner. Indoor seating makes it perfect for any weather. Duration: 45 minutes to 1 hour. Two branches available: Session Road and SM Baguio. Take-out boxes available for bringing cakes back to your accommodation.",
          tags: ["Food & Culinary", "Desserts", "Local Favorite", "Indoor-Friendly", "Budget-friendly", "Family-friendly"]
        }
      ]
    },
    {
      period: "Anytime",
      activities: [
        {
          image: taranaai,
          title: "Baguio Cathedral",
          time: "6:00 AM – 6:00 PM",
          desc: "Neo-Gothic cathedral with twin spires; offers panoramic city views.",
          tags: ["Culture & Arts", "Nature & Scenery", "Indoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Botanical Garden",
          time: "6:00 AM – 6:00 PM",
          desc: "Lush garden showcasing native plants and cultural sculptures.",
          tags: ["Nature & Scenery", "Shopping & Local Finds", "Outdoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "The Mansion",
          time: "8:00 AM – 5:00 PM",
          desc: "Official summer residence of the Philippine President; features a grand gate and manicured lawns.",
          tags: ["Culture & Arts", "Nature & Scenery", "Outdoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Wright Park",
          time: "6:00 AM – 6:00 PM",
          desc: "Tree-lined park with a reflecting pool; known for horseback riding.",
          tags: ["Nature & Scenery", "Adventure", "Outdoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Camp John Hay",
          time: "8:00 AM – 5:00 PM",
          desc: "Former U.S. military base turned into a leisure complex with hotels, golf course, and trails.",
          tags: ["Adventure", "Nature & Scenery", "Outdoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "SM City Baguio",
          time: "10:00 AM – 9:00 PM",
          desc: "Open-air mall with various retail stores, restaurants, and entertainment options.",
          tags: ["Shopping & Local Finds", "Food & Culinary", "Indoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Baguio Public Market",
          time: "5:00 AM – 7:00 PM",
          desc: "Traditional market selling fresh produce, local delicacies, and handicrafts.",
          tags: ["Shopping & Local Finds", "Food & Culinary", "Indoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Good Shepherd Convent",
          time: "8:00 AM – 5:00 PM",
          desc: "Known for its homemade ube jam and other local treats made by nuns.",
          tags: ["Shopping & Local Finds", "Food & Culinary", "Indoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Mirador Heritage and Eco Park",
          time: "6:00 AM – 6:00 PM",
          desc: "Eco-park with trails, bamboo groves, and a peace memorial; offers city views.",
          tags: ["Nature & Scenery", "Culture & Arts", "Outdoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Diplomat Hotel",
          time: "6:00 AM – 6:00 PM",
          desc: "Historic, abandoned hotel known for its architecture and ghost stories.",
          tags: ["Culture & Arts", "Nature & Scenery", "Outdoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Lions Head",
          time: "24 Hours",
          desc: "Iconic lion sculpture along Kennon Road; popular photo stop.",
          tags: ["Nature & Scenery", "Culture & Arts", "Outdoor-Friendly", "Clear Weather Only", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Ili-Likha Artists Village",
          time: "10:00 AM – 8:00 PM",
          desc: "Creative space featuring art installations, eco-friendly architecture, and local eateries.",
          tags: ["Culture & Arts", "Shopping & Local Finds", "Indoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Philippine Military Academy",
          time: "8:00 AM – 5:00 PM",
          desc: "Premier military school with a museum and ceremonial grounds open to visitors.",
          tags: ["Culture & Arts", "Nature & Scenery", "Outdoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Great Wall of Baguio",
          time: "6:00 AM – 6:00 PM",
          desc: "Staircase resembling the Great Wall; offers panoramic views of the city mountains.",
          tags: ["Adventure", "Nature & Scenery", "Outdoor-Friendly", "Clear Weather Only", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Camp John Hay Yellow Trail",
          time: "8:00 AM – 6:00 PM",
          desc: "A scenic, easy trail in Camp John Hay, offering a refreshing walk among pine trees.",
          tags: ["Adventure", "Nature & Scenery", "Outdoor-Friendly", "Clear Weather Only", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Valley of Colors",
          time: "Anytime",
          desc: "A vibrant hillside community in La Trinidad near Baguio, where brightly colored houses form a striking mural.",
          tags: ["Culture & Arts", "Nature & Scenery", "Outdoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Easter Weaving Room",
          time: "8:00 AM – 5:00 PM",
          desc: "A historic center preserving Cordillera weaving, where visitors can watch artisans create handcrafted textiles.",
          tags: ["Culture & Arts", "Shopping & Local Finds", "Indoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Mt. Kalugong",
          time: "6:00 AM – 6:00 PM",
          desc: "Scenic limestone mountain in La Trinidad with stunning valley views and unique rock formations.",
          tags: ["Nature & Scenery", "Adventure", "Outdoor-Friendly", "Clear Weather Only", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Mt. Yangbew",
          time: "6:00 AM – 6:00 PM",
          desc: "Mountain peak offering panoramic views of La Trinidad and surrounding mountains.",
          tags: ["Nature & Scenery", "Adventure", "Outdoor-Friendly", "Clear Weather Only", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Igorot Stone Kingdom",
          time: "6:00 AM – 6:00 PM",
          desc: "Man-made park showcasing stone structures inspired by Igorot culture and mythology.",
          tags: ["Culture & Arts", "Adventure", "Outdoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Laperal White House",
          time: "11:00 AM – 3:00 PM",
          desc: "An elegant colonial-era mansion with a white facade and rich local folklore.",
          tags: ["Culture & Arts", "Adventure", "Indoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Mt. Cloud Bookshop",
          time: "10:30 AM – 6:30 PM",
          desc: "A cozy independent bookstore featuring Philippine literature, local history, and Cordillera culture.",
          tags: ["Culture & Arts", "Nature & Scenery", "Indoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Oh My Gulay",
          time: "11:00 AM – 9:00 PM",
          desc: "Artist-run vegetarian restaurant with mountain views and bohemian setting.",
          tags: ["Food & Culinary", "Culture & Arts", "Indoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Choco-late de Batirol",
          time: "8:00 AM – 8:00 PM",
          desc: "Rustic garden café famous for traditional tsokolate and native delicacies.",
          tags: ["Food & Culinary", "Breakfast", "Outdoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Ili-Likha Food Hub",
          time: "10:00 AM – 9:00 PM",
          desc: "Eco-artist village with diverse food stalls and cultural ambiance.",
          tags: ["Food & Culinary", "Culture & Arts", "Outdoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Canto Bogchi Joint",
          time: "10:00 AM – 10:00 PM",
          desc: "Chill diner popular for affordable ribs and casual vibe.",
          tags: ["Food & Culinary", "Dinner", "Indoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Arca's Yard",
          time: "10:00 AM – 8:00 PM",
          desc: "Home-gallery café with Cordilleran books, heritage food, and hillside views.",
          tags: ["Food & Culinary", "Snack", "Indoor-Friendly", "Weather-Flexible", "Mid-range Budget"]
        },
        {
          image: taranaai,
          title: "Amare La Cucina",
          time: "11:00 AM – 9:00 PM",
          desc: "Authentic brick-oven pizza and pasta in a cozy Italian-inspired space.",
          tags: ["Food & Culinary", "Dinner", "Indoor-Friendly", "Weather-Flexible", "Mid-range Budget"]
        },
        {
          image: taranaai,
          title: "Le Chef at The Manor",
          time: "6:00 AM – 10:00 PM",
          desc: "Elegant dining with world-class ambiance, perfect for special occasions.",
          tags: ["Food & Culinary", "High-end", "Indoor-Friendly", "Weather-Flexible", "High-end Budget"]
        },
        {
          image: taranaai,
          title: "Lemon and Olives",
          time: "11:00 AM – 9:00 PM",
          desc: "Greek-Mediterranean restaurant with stunning views and authentic flavors.",
          tags: ["Food & Culinary", "Dinner", "Indoor-Friendly", "Weather-Flexible", "Mid-range Budget"]
        },
        {
          image: taranaai,
          title: "Grumpy Joe",
          time: "10:00 AM – 9:00 PM",
          desc: "Family-friendly restaurant known for comfort food, pizza, and pasta.",
          tags: ["Food & Culinary", "Lunch", "Indoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Baguio Craft Brewery",
          time: "4:00 PM – 12:00 MN",
          desc: "Local brewery offering craft beer and pulutan with rooftop city views.",
          tags: ["Food & Culinary", "Dinner", "Indoor-Friendly", "Weather-Flexible", "Mid-range Budget"]
        },
        {
          image: taranaai,
          title: "Luisa's Cafe",
          time: "6:30 AM – 9:00 PM",
          desc: "Classic Filipino-Chinese eatery serving affordable meals, popular among locals and artists.",
          tags: ["Food & Culinary", "Breakfast", "Indoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Agara Ramen",
          time: "11:00 AM – 9:00 PM",
          desc: "Cozy ramen bar serving rich and flavorful bowls in Japanese ambiance.",
          tags: ["Food & Culinary", "Dinner", "Indoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "50's Diner",
          time: "7:00 AM – 10:00 PM",
          desc: "Nostalgic American-style diner with retro vibes and huge portions.",
          tags: ["Food & Culinary", "Lunch", "Indoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Balajadia Kitchenette",
          time: "6:00 AM – 9:00 PM",
          desc: "Simple eatery serving local carinderia-style Filipino dishes.",
          tags: ["Food & Culinary", "Lunch", "Indoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Wagner Cafe",
          time: "7:00 AM – 7:00 PM",
          desc: "Serene garden café perfect for brunch and healthy eats.",
          tags: ["Food & Culinary", "Breakfast", "Outdoor-Friendly", "Weather-Flexible", "Budget-friendly"]
        },
        {
          image: taranaai,
          title: "Pizza Volante",
          time: "24 Hours",
          desc: "Go-to pizza and pasta spot for night owls and late diners.",
          tags: ["Food & Culinary", "Dinner", "Indoor-Friendly", "Weather-Flexible", "Budget-friendly"]
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