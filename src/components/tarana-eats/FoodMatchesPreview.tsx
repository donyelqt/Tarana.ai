import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { taranaai } from '../../../public';

interface ResultMatch {
  name: string;
  meals: number;
  price: number;
  image: string;
}

interface FoodMatchesPreviewProps {
  results: { matches: ResultMatch[] } | null;
}

export default function FoodMatchesPreview({ results }: FoodMatchesPreviewProps) {
  return (
    <div className="rounded-lg h-full p-6 w-full">
      <h2 className="text-xl font-bold mb-2">Your Food Matches</h2>
      <p className="text-gray-500 mb-6">A preview of your matched meal plans!</p>
      
      {results ? (
        <div className="space-y-4">
          {results.matches.map((match, idx) => (
            <div key={idx} className=" rounded-xl shadow border p-4">
              <div className="relative w-full h-32 rounded-lg mb-4 overflow-hidden">
                <Image src={match.image} alt={match.name} fill style={{objectFit: "cover"}} />
              </div>
              <div className="font-semibold text-lg">{match.name}</div>
              <div className="text-gray-500 text-sm">{match.meals} meals under ₱{match.price}</div>
              <div className="flex items-center justify-between mt-4">
                <Button>View Menu</Button>
                <Button variant="outline" size="icon">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-3.125L5 18V4z" />
                  </svg>
                </Button>
              </div>
            </div>
          ))}
          <Button className="w-full mt-4">Save Itinerary</Button>
        </div>
      ) : (
        <div className="text-center rounded-lg flex flex-col items-center shadow-lg justify-center h-[90vh]">
          <Image src={taranaai} alt="logo" width={100} height={100} className="mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Find Your Next Meal</h3>
          <p className="text-gray-500">Your food matches will appear here.</p>
        </div>
      )}
    </div>
  );
}