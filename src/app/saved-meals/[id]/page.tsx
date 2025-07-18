"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Clock, Trash2, Coffee, MapPin, User, Utensils, Croissant } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useParams, useRouter } from 'next/navigation';
import { savedMeals } from '../data';
import Link from 'next/link';

const mealDetailsData = {
  '1': {
    name: 'Cafe Ysap',
    location: 'Loakan, Baguio City',
    hours: '9AM - 6PM',
    priceRange: '₱150-₱900',
    about: `A cozy café tucked in the heart of Baguio, Café Ysap serves home-cooked Filipino meals made with fresh, local ingredients. Known for its warm ambience and hearty silog plates, it's the perfect stop for comfort food and mountain air.`,
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
      { name: 'Tapsilog', type: 'Breakfast', price: 150, image: '/images/bencab.png', goodFor: 1 },
      { name: 'Longsilog', type: 'Breakfast', price: 150, image: '/images/burnham.png', goodFor: 1 },
      { name: 'Tocilog', type: 'Breakfast', price: 150, image: '/images/caferuins.png', goodFor: 1 },
    ]
  },
  '2': {
    name: 'Golden Wok Cafe',
    location: 'Upper QM, near Lourdes Grotto, Baguio City',
    hours: '11AM - 10PM',
    priceRange: '₱180-₱700',
    about: `Golden Wok Cafe offers authentic Chinese cuisine with a Filipino twist. Known for its generous portions and affordable prices, this local favorite features classic stir-fry dishes, noodles, and dimsum in a casual dining atmosphere.`,
    image: '/images/goodtaste.png',
    savedMeals: [
      {
        id: 'meal2',
        name: 'Special Dinner Set',
        type: 'Dinner',
        items: [
          { name: 'Sweet and Sour Pork', price: 220, quantity: 1 },
          { name: 'Yang Chow Fried Rice', price: 180, quantity: 1 }
        ],
        totalPrice: 400,
        goodFor: 2
      }
    ],
    menuItems: [
      { name: 'Sweet and Sour Pork', type: 'Dinner', price: 220, image: '/images/hillstation.png', goodFor: 2 },
      { name: 'Yang Chow Fried Rice', type: 'Dinner', price: 180, image: '/images/goodtaste.png', goodFor: 2 },
      { name: 'Beef with Broccoli', type: 'Dinner', price: 250, image: '/images/viewspark.png', goodFor: 2 },
    ]
  },
  '3': {
    name: 'Sakura Sip & Snack',
    location: 'Military Cut-off Road, Baguio City',
    hours: '10AM - 8PM',
    priceRange: '₱80-₱350',
    about: `Sakura Sip & Snack is a charming Japanese-inspired cafe offering a variety of light meals, pastries, and specialty drinks. Known for their matcha selections and aesthetic ambiance, it's perfect for afternoon tea or a quick snack while exploring Baguio.`,
    image: '/images/letai.png',
    savedMeals: [
      {
        id: 'meal3',
        name: 'Afternoon Tea Set',
        type: 'Snack',
        items: [
          { name: 'Matcha Latte', price: 120, quantity: 1 },
          { name: 'Cheese Tart', price: 80, quantity: 1 }
        ],
        totalPrice: 200,
        goodFor: 1
      }
    ],
    menuItems: [
      { name: 'Matcha Latte', type: 'Drinks', price: 120, image: '/images/letai.png', goodFor: 1 },
      { name: 'Cheese Tart', type: 'Snacks', price: 80, image: '/images/tamawan.png', goodFor: 1 },
      { name: 'Fruit Parfait', type: 'Snacks', price: 150, image: '/images/nightmarket.png', goodFor: 1 },
    ]
  }
};

const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks'];

const MealIcon = ({ type, className }: { type: string, className?: string }) => {
  if (type === 'Breakfast') return <Coffee className={className || 'w-4 h-4 mr-2'} />;
  if (type === 'Dinner') return <Utensils className={className || 'w-4 h-4 mr-2'} />;
  if (type === 'Snack' || type === 'Snacks') return <Croissant className={className || 'w-4 h-4 mr-2'} />;
  return null;
};

const SavedMealPage = () => {
  const params = useParams();
  const router = useRouter();
  const mealId = params.id as string;
  const [mealDetails, setMealDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState('Breakfast');
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  
  useEffect(() => {
    // Get the meal ID from the URL query parameter
    const searchParams = new URLSearchParams(window.location.search);
    const mealParam = searchParams.get('meal');
    if (mealParam) {
      setSelectedMealId(mealParam);
    }
    
    const details = mealDetailsData[mealId as keyof typeof mealDetailsData];
    
    if (!details) {
      // Redirect to saved meals page if the meal ID doesn't exist
      router.push('/saved-meals');
      return;
    }
    
    setMealDetails(details);
    setLoading(false);
    
    if (details && details.menuItems.length > 0) {
      setActiveMenu(details.menuItems[0].type);
    }
    
    document.title = `Tarana.ai | ${details?.name || 'Meal'}`;
  }, [mealId, router]);

  if (loading || !mealDetails) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex">
        <Sidebar />
        <main className="flex-1 md:pl-72 p-8 flex items-center justify-center">
          <p className="text-lg text-gray-500">Loading meal details...</p>
        </main>
      </div>
    );
  }

  const filteredMenuItems = mealDetails.menuItems.filter((item: any) => item.type === activeMenu);

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex">
      <Sidebar />
      <main className="flex-1 md:pl-72 p-8">
        <div className="text-sm text-gray-500 mb-4">
          <Link href="/saved-meals" className="hover:text-blue-600">Saved Plans</Link> &gt; <Link href="/saved-meals" className="hover:text-blue-600">Meals</Link> &gt; {mealDetails.name}
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
          <div className="xl:col-span-2 flex flex-col gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-[#7d5a44] flex-shrink-0 flex items-center justify-center text-white text-center font-bold text-lg leading-tight">
                Cafe<br/>Ysap
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900">{mealDetails.name}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-500 mt-2">
                  <span className="flex items-center gap-1.5"><MapPin size={16} />{mealDetails.location}</span>
                  <span className="flex items-center gap-1.5"><Clock size={16} />{mealDetails.hours}</span>
                </div>
                <p className="text-gray-500 mt-1 font-medium">{mealDetails.priceRange}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 mb-2">About</h2>
              <p className="text-gray-600 text-base leading-relaxed">{mealDetails.about}</p>
            </div>
          </div>
          <div className="w-full h-64 xl:h-auto rounded-2xl overflow-hidden relative">
            <Image src={mealDetails.image} alt="Cafe Ysap" fill className="object-cover" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Saved Meals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mealDetails.savedMeals.map((savedMeal: any) => {
              const isSelected = selectedMealId === savedMeal.id;
              return (
                <div 
                  key={savedMeal.id} 
                  className={`bg-white rounded-xl p-6 border w-full ${
                    isSelected 
                      ? 'border-blue-500 ring-2 ring-blue-200' 
                      : 'border-gray-200'
                  }`}
                >
                  {isSelected && (
                    <div className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full mb-3 inline-block">
                      Selected Meal
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold">{savedMeal.name}</h3>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MealIcon type={savedMeal.type} className="w-5 h-5" />
                      <span className="font-medium">{savedMeal.type}</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-gray-500">
                    {savedMeal.items.map((item: any, idx: number) => (
                      <p key={idx}>{item.name} - ₱{item.price} x {item.quantity}</p>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-4">
                    <p className="text-lg font-bold">Total: ₱{savedMeal.totalPrice.toFixed(2)}</p>
                    <p className="text-gray-500">Good for {savedMeal.goodFor}pax</p>
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <Link href={`/saved-meals/${mealId}?meal=${savedMeal.id}`} passHref>
                      <Button 
                        className={`flex-1 py-3 h-auto rounded-lg ${
                          isSelected 
                            ? 'bg-green-600 hover:bg-green-700 text-white font-semibold'
                            : 'bg-blue-600 hover:bg-blue-700 text-white font-semibold'
                        }`}
                      >
                        {isSelected ? 'Selected Meal' : 'View Meal Card'}
                      </Button>
                    </Link>
                    <Button variant="outline" size="icon" className="h-12 w-12 border-gray-300 rounded-lg">
                      <Trash2 className="w-5 h-5 text-gray-500" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl py-4 px-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <h2 className="text-2xl font-bold text-gray-900">Full Menu</h2>
            <div className="flex items-center gap-4 flex-wrap">
              {mealTypes.map((type) => (
                <Button
                  key={type}
                  variant={activeMenu === type ? "default" : "outline"}
                  onClick={() => setActiveMenu(type)}
                  className={`rounded-lg px-6 py-2 text-base font-medium transition-all duration-200 ${
                    activeMenu === type 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="mt-6 rounded-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredMenuItems.map((item: any, idx: number) => (
              <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                <div className="relative w-full h-56">
                  <Image src={item.image} alt={item.name} fill className="object-cover" />
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{item.name}</h3>
                    <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                      <MealIcon type={item.type} className="w-4 h-4" />{item.type}
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-blue-600 mb-2">₱{item.price}</p>
                  <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-4">
                    <User size={14} />Good for {item.goodFor}
                  </div>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 h-auto rounded-lg mt-auto">Save to My Meals</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SavedMealPage; 