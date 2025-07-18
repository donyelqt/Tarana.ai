"use client";

import React, { useState } from 'react';
import { 
  restaurants, 
  getMenuByRestaurantName, 
  allRestaurantMenus 
} from './data/taranaEatsData';
import Image from 'next/image';

// This component demonstrates how to use the full menu data
export default function TestMenuData() {
  const [selectedRestaurant, setSelectedRestaurant] = useState(restaurants[0].name);
  const [selectedCategory, setSelectedCategory] = useState('Breakfast');
  const [showingStructure, setShowingStructure] = useState(false);
  
  // Get the full menu for the selected restaurant
  const fullMenu = getMenuByRestaurantName(selectedRestaurant);
  
  // Get restaurant details
  const restaurantDetails = restaurants.find(r => r.name === selectedRestaurant);
  
  // Get items for the selected category
  const menuItems = fullMenu[selectedCategory as keyof typeof fullMenu] || [];
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Tarana Eats Menu Explorer</h1>
      <p className="text-gray-600 mb-6">Test the organized menu data structure for each restaurant</p>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-4">Restaurant Selection</h2>
            
            <div className="space-y-4">
              {restaurants.map(restaurant => (
                <button
                  key={restaurant.name}
                  onClick={() => setSelectedRestaurant(restaurant.name)}
                  className={`w-full text-left p-3 rounded-lg transition ${
                    selectedRestaurant === restaurant.name
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className="font-medium">{restaurant.name}</div>
                  <div className="text-sm text-gray-500">{restaurant.cuisine.join(', ')}</div>
                </button>
              ))}
            </div>
            
            <h2 className="text-xl font-semibold mt-6 mb-4">Menu Categories</h2>
            <div className="flex flex-wrap gap-2">
              {Object.keys(fullMenu).map(category => (
                <button
                  key={category}
                  className={`px-4 py-2 rounded-md ${
                    category === selectedCategory 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="md:col-span-3">
          <div className="bg-white rounded-lg shadow p-4">
            {restaurantDetails && (
              <div className="flex gap-4 items-center pb-4 border-b mb-4">
                <div className="relative w-20 h-20 rounded-lg overflow-hidden">
                  <Image src={restaurantDetails.image} alt={restaurantDetails.name} fill className="object-cover" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{restaurantDetails.name}</h2>
                  <p className="text-gray-600">{restaurantDetails.location}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="text-yellow-500">★ {restaurantDetails.ratings}</div>
                    <span className="text-sm text-gray-500">• Popular for: {restaurantDetails.popularFor.join(', ')}</span>
                  </div>
                </div>
              </div>
            )}
            
            <h3 className="text-xl font-semibold mb-4">
              {selectedCategory} Menu
            </h3>
            
            {menuItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {menuItems.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4 shadow-sm hover:shadow-md transition">
                    <div className="relative h-36 mb-3 rounded overflow-hidden">
                      <Image src={item.image} alt={item.name} fill className="object-cover" />
                    </div>
                    <div className="font-semibold text-lg">{item.name}</div>
                    <div className="text-gray-500 text-sm mt-1 h-12 overflow-hidden">{item.description}</div>
                    <div className="mt-2 font-bold text-blue-600">₱{item.price.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 p-8 text-center border rounded-lg">
                <p>No items available in this category.</p>
              </div>
            )}
          </div>
          
          {/* Data Structure View */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setShowingStructure(!showingStructure)}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {showingStructure ? 'Hide Data Structure' : 'Show Data Structure'}
            </button>
          </div>
          
          {showingStructure && (
            <div className="mt-2 bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-2">Data Structure</h3>
              <div className="bg-gray-50 p-4 rounded-md overflow-auto max-h-96">
                <pre className="text-xs">{JSON.stringify({
                  restaurantName: selectedRestaurant,
                  menuCategories: Object.keys(fullMenu),
                  selectedCategory,
                  itemsInCategory: menuItems.length,
                  sampleMenuItem: menuItems[0] || null,
                  restaurantDetails: {
                    cuisine: restaurantDetails?.cuisine,
                    priceRange: restaurantDetails?.priceRange,
                    popularFor: restaurantDetails?.popularFor,
                    tags: restaurantDetails?.tags,
                    dietaryOptions: restaurantDetails?.dietaryOptions
                  }
                }, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 