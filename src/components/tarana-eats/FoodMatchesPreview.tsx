import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { taranaai } from '../../../public';
import MenuPopup from './MenuPopup';
import { MenuItem, ResultMatch } from '@/types/tarana-eats';

interface FoodMatchesPreviewProps {
  results: { matches: ResultMatch[] } | null;
}

export default function FoodMatchesPreview({ results }: FoodMatchesPreviewProps) {
  const [activeMatch, setActiveMatch] = useState<ResultMatch | null>(null);
  const [savedSelections, setSavedSelections] = useState<Record<string, MenuItem[]>>({});

  const handleSaveSelection = (restaurantName: string, items: MenuItem[]) => {
    setSavedSelections(prev => ({ ...prev, [restaurantName]: items }));
  };

  return (
    <>
      {activeMatch && (
        <MenuPopup
          match={activeMatch}
          onClose={() => setActiveMatch(null)}
          onSave={(items) => handleSaveSelection(activeMatch.name, items)}
        />
      )}
      <div className="rounded-lg h-full p-6 w-full">
        {results ? (
          <>
            <h2 className="text-xl font-bold mb-2">Your Food Matches</h2>
            <p className="text-gray-500 mb-6">A preview of your matched meal plans!</p>
            <div className="space-y-4">
              {results.matches.map((match, idx) => {
                const selection = savedSelections[match.name];
                const total = selection?.reduce((sum, item) => sum + item.price, 0);

                return (
                  <div key={idx} className=" rounded-xl shadow border p-4">
                    <div className="relative w-full h-32 rounded-lg mb-4 overflow-hidden">
                      <Image src={match.image} alt={match.name} fill style={{ objectFit: "cover" }} />
                    </div>
                    <div className="font-semibold text-lg">{match.name}</div>
                    <div className="text-gray-500 text-sm">{match.meals} meals under ₱{match.price}</div>
                    
                    {selection && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <h4 className="font-semibold text-sm">Your Selection</h4>
                          <p className="font-bold text-sm">Total: ₱{total}</p>
                        </div>
                        <ul className="list-disc pl-5 mt-2 text-sm text-gray-600">
                          {selection.map(item => <li key={item.name}>{item.name} - ₱{item.price}</li>)}
                        </ul>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-4">
                      <Button onClick={() => setActiveMatch(match)}>
                        {selection ? 'Edit Menu' : 'View Menu'}
                      </Button>
                      <Button variant="outline" size="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-3.125L5 18V4z" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                );
              })}
              <Button className="w-full mt-4">Save Meals</Button>
            </div>
          </>
        ) : (
          <div className="text-center rounded-lg flex flex-col items-center justify-center h-[90vh]">
            <Image src={taranaai} alt="logo" width={100} height={100} className="mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Find Your Next Meal</h3>
            <p className="text-gray-500">Your food matches will appear here.</p>
          </div>
        )}
      </div>
    </>
  );
}