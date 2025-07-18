import React from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { ResultMatch, MenuItem } from '@/types/tarana-eats';

interface FoodMatchCardProps {
  match: ResultMatch;
  selectedItems?: MenuItem[];
  onViewMenu: (match: ResultMatch) => void;
  onBookmark?: () => void;
}

export default function FoodMatchCard({ 
  match, 
  selectedItems = [], 
  onViewMenu, 
  onBookmark 
}: FoodMatchCardProps) {
  const total = selectedItems.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="rounded-xl shadow border p-4">
      <div className="relative w-full h-32 rounded-lg mb-4 overflow-hidden">
        <Image src={match.image} alt={match.name} fill style={{ objectFit: "cover" }} />
      </div>
      <div className="font-semibold text-lg">{match.name}</div>
      <div className="text-gray-500 text-sm">{match.meals} meals under ₱{match.price}</div>
      
      {/* AI Recommendation Reason */}
      {match.reason && (
        <div className="mt-2 px-2 py-1 bg-blue-50 rounded text-sm text-blue-800 border border-blue-100">
          <p className="italic">"{match.reason}"</p>
        </div>
      )}
      
      {selectedItems.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold text-sm">Your Selection</h4>
            <p className="font-bold text-sm">Total: ₱{total}</p>
          </div>
          <ul className="list-disc pl-5 mt-2 text-sm text-gray-600">
            {selectedItems.map(item => (
              <li key={item.name}>{item.name} - ₱{item.price}</li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="flex items-center justify-between mt-4">
        <Button onClick={() => onViewMenu(match)}>
          {selectedItems.length > 0 ? 'Edit Menu' : 'View Menu'}
        </Button>
        {onBookmark && (
          <Button variant="outline" size="icon" onClick={onBookmark}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-3.125L5 18V4z" />
            </svg>
          </Button>
        )}
      </div>
    </div>
  );
} 