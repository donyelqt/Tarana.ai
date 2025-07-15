import React, { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PlusIcon, CheckIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";

interface ResultMatch {
  name: string;
  meals: number;
  price: number;
  image: string;
}

interface MenuItem {
  name: string;
  description: string;
  price: number;
  image: string;
}

interface MenuPopupProps {
  match: ResultMatch;
  onClose: () => void;
}

// Static sample menu data; replace with real data as needed
const MENU_DATA: Record<string, MenuItem[]> = {
  "Hill Station": [
    {
      name: "Beef Pares",
      description: "Tender beef stew with garlic rice.",
      price: 150,
      image: "/images/hillstation.png",
    },
    {
      name: "Kapeng Barako",
      description: "Strong local coffee blend.",
      price: 55,
      image: "/images/hillstation.png",
    },
    {
      name: "Pinikpikan Bowl",
      description: "Traditional Cordilleran chicken soup.",
      price: 180,
      image: "/images/hillstation.png",
    },
  ],
  "Itaewon Cafe": [
    {
      name: "Bibimbap",
      description: "Korean mixed rice with vegetables and meat.",
      price: 200,
      image: "/images/itaewon.png",
    },
    {
      name: "Tteokbokki",
      description: "Spicy Korean rice cakes.",
      price: 120,
      image: "/images/itaewon.png",
    },
  ],
};

export default function MenuPopup({ match, onClose }: MenuPopupProps) {
  const menuItems = MENU_DATA[match.name] ?? [];
  const [selected, setSelected] = useState<MenuItem[]>([]);

  const toggleItem = (item: MenuItem) => {
    setSelected((prev) =>
      prev.find((i) => i.name === item.name)
        ? prev.filter((i) => i.name !== item.name)
        : [...prev, item]
    );
  };

  const total = selected.reduce((sum, item) => sum + item.price, 0);
  const remaining = match.price - total;
  const isOverBudget = remaining < 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative mx-auto w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6">
        {/* Close */}
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute top-4 right-4 text-2xl font-bold text-gray-500 hover:text-gray-700"
        >
          &times;
        </button>

        {/* Header */}
        <div className="mb-6 flex items-start gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-full">
            <Image
              src={match.image}
              alt={match.name}
              fill
              sizes="40px"
              style={{ objectFit: "cover" }}
            />
          </div>
          <div>
            <h2 className="text-xl font-semibold leading-snug">{match.name}</h2>
            <p className="text-xs text-gray-500">
              Showing menu items within your budget: ₱{match.price} per person ({match.price * match.meals} total for {match.meals} {match.meals === 1 ? "person" : "people"})
            </p>
          </div>
        </div>

        {/* Menu List */}
        <div className="space-y-4">
          {menuItems.map((item) => {
            const isSelected = !!selected.find((i) => i.name === item.name);
            return (
              <div
                key={item.name}
                className="flex items-center gap-4 rounded-xl border p-4 shadow"
              >
                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="80px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <div className="flex-1">
                  <div className="text-lg font-semibold">{item.name}</div>
                  <div className="text-sm text-gray-500">{item.description}</div>
                  <div className="mt-1 text-sm">₱{item.price}</div>
                </div>
                <Button
                  onClick={() => toggleItem(item)}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium",
                    isSelected
                      ? "border border-[#0066FF] bg-white text-[#0066FF] hover:bg-gray-50"
                      : "bg-gradient-to-r from-[#0066FF] to-[#0052cc] text-white hover:opacity-90"
                  )}
                >
                  {isSelected ? (
                    <>
                      <CheckIcon className="h-4 w-4" /> Added
                    </>
                  ) : (
                    <>
                      <PlusIcon className="h-4 w-4" /> Add
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Summary & Actions */}
        <div className="mt-6 border-t pt-4">
          <div className="flex items-center justify-between gap-6">
            <div>
              <div className="text-sm text-gray-500">Selected Items ({selected.length})</div>
              <div className="font-medium">Total: ₱{total}/₱{match.price} Budget</div>
              <div className={cn("text-sm", isOverBudget ? "text-red-500" : "text-gray-500")}>Remaining Budget: {isOverBudget ? "Over Budget" : `₱${remaining}`}</div>
            </div>

            <div className="flex flex-1 justify-end gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                disabled={selected.length === 0 || isOverBudget}
                className="flex-1 bg-gradient-to-r from-[#0066FF] to-[#0052cc] text-white disabled:opacity-50"
              >
                Save Selection
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 