import React from "react";
import { Button } from "@/components/ui/button";

interface ResultMatch {
  name: string;
  meals: number;
  price: number;
  image: string;
}

interface TaranaEatsResultsProps {
  results: { matches: ResultMatch[] };
  onBack: () => void;
}

export default function TaranaEatsResults({ results, onBack }: TaranaEatsResultsProps) {
  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Main Content */}
      <div className="flex-1">
        <h2 className="text-2xl font-bold mb-2">Your Food Matches</h2>
        <p className="text-gray-500 mb-6">A preview of your matched meal plans!</p>
        <div className="grid grid-cols-1 gap-6">
          {results.matches.map((match, idx) => (
            <div key={idx} className="flex items-center bg-white rounded-xl shadow border p-4">
              <img src={match.image} alt={match.name} className="w-24 h-20 object-cover rounded-lg mr-4" />
              <div className="flex-1">
                <div className="font-semibold text-lg">{match.name}</div>
                <div className="text-gray-500 text-sm">{match.meals} meals under ₱{match.price}</div>
              </div>
              <Button className="ml-4">View Menu</Button>
            </div>
          ))}
        </div>
        <Button variant="outline" className="mt-8" onClick={onBack}>Back to Form</Button>
      </div>
      {/* Sidebar */}
      <div className="w-full md:w-80 flex-shrink-0">
        <div className="bg-white rounded-2xl shadow border p-6 mb-4">
          <h3 className="font-semibold text-lg mb-2">Save your itinerary</h3>
          <Button className="w-full">Save Itinerary</Button>
        </div>
      </div>
    </div>
  );
}