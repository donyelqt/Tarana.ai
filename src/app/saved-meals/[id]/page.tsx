"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Clock, Trash2, Utensils, Coffee, Croissant, Pizza } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useParams } from 'next/navigation';
import { savedMeals } from '../data';

// Extended data for individual meal pages
const mealDetailsData = {
  '1': {
    name: 'Cafe Ysap',
    location: 'Loakan, Baguio City',
    hours: '9AM - 6PM',
    priceRange: '₱150-₱900',
    about: 'A cozy café tucked in the heart of Baguio, Café Ysap serves home-cooked Filipino meals made with fresh, local ingredients. Known for its warm ambience and hearty silog plites, it\'s the perfect stop for comfort food and mountain air.',
    image: '/images/caferuins.png',
    savedMeals: [
      {
        id: 'meal1',
        name: 'Custom Meal 1',
        type: 'Breakfast',
        items: [
          { name: 'Tapsilog', price: 150, quantity: 2 },
          { name: 'Brewed Coffee', price: 60, quantity: 2 }
        ],
        totalPrice: 420,
        goodFor: 2
      }
    ],
    menuItems: [
      { name: 'Tapsilog', type: 'Breakfast', price: 150, image: '/images/bencab.png' },
      { name: 'Longsilog', type: 'Breakfast', price: 150, image: '/images/burnham.png' },
      { name: 'Tocilog', type: 'Breakfast', price: 150, image: '/images/caferuins.png' },
    ]
  },
  '2': {
    name: 'Golden Wok Cafe',
    location: 'Upper QM, near Lourdes Grotto, Baguio City',
    hours: '10AM - 9PM',
    priceRange: '₱180-₱1200',
    about: 'Golden Wok Cafe offers authentic Chinese cuisine with a Filipino twist. Their specialties include dim sum, noodle soups, and stir-fried dishes that blend traditional recipes with local flavors.',
    image: '/images/goodtaste.png',
    savedMeals: [
      {
        id: 'meal2',
        name: 'Family Dinner Set',
        type: 'Dinner',
        items: [
          { name: 'Sweet and Sour Pork', price: 280, quantity: 1 },
          { name: 'Yang Chow Fried Rice', price: 220, quantity: 1 },
          { name: 'Beef with Broccoli', price: 320, quantity: 1 },
          { name: 'Iced Tea', price: 50, quantity: 4 }
        ],
        totalPrice: 1020,
        goodFor: 4
      }
    ],
    menuItems: [
      { name: 'Sweet and Sour Pork', type: 'Dinner', price: 280, image: '/images/goodtaste.png' },
      { name: 'Yang Chow Fried Rice', type: 'Dinner', price: 220, image: '/images/hillstation.png' },
      { name: 'Beef with Broccoli', type: 'Dinner', price: 320, image: '/images/goodtaste.png' },
    ]
  },
  '3': {
    name: 'Sakura Sip & Snack',
    location: 'Military Cut-off Road, Baguio City',
    hours: '8AM - 8PM',
    priceRange: '₱100-₱500',
    about: 'Sakura Sip & Snack is a charming Japanese-inspired café offering a variety of teas, coffees, and light snacks. Their matcha desserts and milk tea selections are popular among locals and tourists alike.',
    image: '/images/letai.png',
    savedMeals: [
      {
        id: 'meal3',
        name: 'Afternoon Tea Set',
        type: 'Snack',
        items: [
          { name: 'Matcha Cake', price: 120, quantity: 2 },
          { name: 'Brown Sugar Milk Tea', price: 130, quantity: 2 }
        ],
        totalPrice: 500,
        goodFor: 2
      }
    ],
    menuItems: [
      { name: 'Matcha Cake', type: 'Snack', price: 120, image: '/images/letai.png' },
      { name: 'Brown Sugar Milk Tea', type: 'Snack', price: 130, image: '/images/tamawan.png' },
      { name: 'Strawberry Cheesecake', type: 'Snack', price: 150, image: '/images/letai.png' },
    ]
  }
};

const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks'];

const MealIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'Breakfast':
            return <Coffee className="w-4 h-4 mr-2" />;
        case 'Dinner':
            return <Utensils className="w-4 h-4 mr-2" />;
        case 'Snacks':
        case 'Snack':
            return <Croissant className="w-4 h-4 mr-2" />;
        default:
            return <Pizza className="w-4 h-4 mr-2" />;
    }
}

const SavedMealPage = () => {
  const params = useParams();
  const mealId = params.id as string;
  const [mealDetails, setMealDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching data
    const fetchData = async () => {
      setLoading(true);
      try {
        // In a real app, this would be an API call
        const details = mealDetailsData[mealId as keyof typeof mealDetailsData];
        
        if (details) {
          setMealDetails(details);
          // Update document title programmatically
          document.title = `Tarana.ai | ${details.name}`;
        } else {
          console.error('Meal details not found');
        }
      } catch (error) {
        console.error('Error fetching meal details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mealId]);

  if (loading) {
    return (
      <div className="flex flex-col md:flex-row bg-gray-50/50 min-h-screen">
        <Sidebar />
        <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto overflow-x-hidden md:ml-64">
          <div className="flex justify-center items-center h-screen">
            <p className="text-lg">Loading meal details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!mealDetails) {
    return (
      <div className="flex flex-col md:flex-row bg-gray-50/50 min-h-screen">
        <Sidebar />
        <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto overflow-x-hidden md:ml-64">
          <div className="flex justify-center items-center h-screen">
            <p className="text-lg">Meal not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row bg-gray-50/50 min-h-screen">
      <Sidebar />
      <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto overflow-x-hidden md:ml-64">
        <header className="flex items-center justify-between mt-14 md:mt-0">
            <div>
                <p className="text-sm text-gray-500">Saved Plans &gt; Meals &gt; {mealDetails.name}</p>
            </div>
        </header>
        <div className="mt-6 md:mt-8">
          <div className="flex flex-col lg:flex-row items-start bg-white p-4 sm:p-6 rounded-2xl shadow-sm">
            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-amber-800 flex items-center justify-center mr-4 sm:mr-6 shrink-0">
                <span className="text-white font-bold text-xl md:text-2xl">{mealDetails.name.split(' ').map((word: string) => word[0]).join('')}</span>
            </div>
            <div className='flex-1 mt-4 lg:mt-0'>
              <h1 className="text-2xl sm:text-3xl font-bold">{mealDetails.name}</h1>
              <p className="text-gray-500 mt-1">{mealDetails.location}</p>
              <div className="flex items-center text-sm text-gray-500 mt-2">
                <Clock size={16} className="mr-2" />
                <span>{mealDetails.hours}</span>
                <span className="mx-2">|</span>
                <span>{mealDetails.priceRange}</span>
              </div>
              <div className="mt-4">
                <h2 className="font-semibold">About</h2>
                <p className="text-gray-600 text-sm mt-1">
                  {mealDetails.about}
                </p>
              </div>
            </div>
            <div className="w-full lg:w-2/5 h-40 sm:h-48 md:h-56 relative rounded-2xl overflow-hidden mt-4 lg:mt-0 lg:ml-6">
                <Image
                    src={mealDetails.image}
                    alt={`${mealDetails.name} Interior`}
                    layout='fill'
                    objectFit='cover'
                />
            </div>
          </div>
        </div>

        {mealDetails.savedMeals && mealDetails.savedMeals.length > 0 && (
          <div className="mt-6 md:mt-8">
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Your Saved Meals</h2>
            {mealDetails.savedMeals.map((savedMeal: any) => (
              <div key={savedMeal.id} className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm mb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <div>
                    <h3 className="text-lg font-bold">{savedMeal.name}</h3>
                    {savedMeal.items.map((item: any, index: number) => (
                      <p key={index} className="text-sm text-gray-500 mt-1">
                        {item.name} - ₱{item.price} x {item.quantity}
                      </p>
                    ))}
                  </div>
                  <div className="flex items-center mt-2 sm:mt-0">
                    <MealIcon type={savedMeal.type} />
                    <span className="text-gray-600 font-medium">{savedMeal.type}</span>
                  </div>
                </div>
                <div className="border-t my-4"></div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <p className="text-xl font-bold">Total: ₱{savedMeal.totalPrice.toFixed(2)}</p>
                  <p className="text-sm text-gray-500 mt-1 sm:mt-0">Good for {savedMeal.goodFor}pax</p>
                </div>
                <div className="flex items-center mt-4">
                  <Button className="bg-blue-600 text-white flex-1 mr-2">View Meal Card</Button>
                  <Button variant="outline" size="icon" className="rounded-full">
                    <Trash2 className="w-5 h-5 text-gray-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 md:mt-8">
          <h2 className="text-xl sm:text-2xl font-bold mb-4">Full Menu</h2>
          <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2">
            {mealTypes.map((type) => (
              <Button
                key={type}
                variant={type === mealDetails.savedMeals[0]?.type ? 'default' : 'outline'}
                className={`${type === mealDetails.savedMeals[0]?.type ? "bg-blue-600 text-white" : "bg-white"} rounded-full px-4 sm:px-6 text-sm whitespace-nowrap`}
              >
                {type}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {mealDetails.menuItems.map((item: any, index: number) => (
              <div key={index} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className='relative h-40 sm:h-48'>
                    <Image
                    src={item.image}
                    alt={item.name}
                    layout='fill'
                    objectFit='cover'
                    />
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold">{item.name}</h3>
                    <div className="flex items-center text-sm text-gray-500">
                        <MealIcon type={item.type}/>
                        <span>{item.type}</span>
                    </div>
                  </div>
                  <p className="text-lg font-semibold text-blue-600 mt-2">₱{item.price}</p>
                  <p className="text-sm text-gray-500 mt-1">Good for 1</p>
                  <Button className="w-full mt-4 bg-blue-600 text-white rounded-full">Save to My Meals</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SavedMealPage; 