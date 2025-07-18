import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PlusIcon, CheckIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";
import { ResultMatch, MenuItem } from "@/types/tarana-eats";
import { MENU_DATA } from "../data/menuData";

interface MenuPopupProps {
  match: ResultMatch;
  selectedItems: MenuItem[];
  onClose: () => void;
  onToggleItem: (item: MenuItem) => void;
  onSave: () => void;
}

export default function MenuPopup({ 
  match, 
  selectedItems, 
  onClose, 
  onToggleItem, 
  onSave 
}: MenuPopupProps) {
  const menuItems = MENU_DATA[match.name] ?? [];
  
  const total = selectedItems.reduce((sum, item) => sum + item.price, 0);
  const budgetPerPerson = match.price * match.meals;
  const remaining = budgetPerPerson - total;
  const isOverBudget = remaining < 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative mx-auto flex w-full max-w-xl flex-col max-h-[90vh] rounded-2xl bg-white">
        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-start gap-4">
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full">
              <Image
                src={match.image}
                alt={match.name}
                fill
                sizes="48px"
                className="object-cover"
              />
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight">{match.name}</h2>
              <p className="text-sm text-gray-500">
                Showing menu items within your budget: ₱{match.price} per person (₱{budgetPerPerson} total for {match.meals} {match.meals === 1 ? "person" : "people"})
              </p>
            </div>
          </div>

          {/* Menu List */}
          <div className="space-y-3">
            {menuItems.map((item) => {
              const isSelected = !!selectedItems.find((i) => i.name === item.name);
              return (
                <div
                  key={item.name}
                  className="flex items-center gap-4 rounded-xl border p-3 shadow-sm"
                >
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-sm text-gray-500">{item.description}</div>
                    <div className="mt-1 text-sm font-medium">₱{item.price}</div>
                  </div>
                  <Button
                    onClick={() => onToggleItem(item)}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-lg px-4 py-2 text-sm font-medium w-24",
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
        </div>

        {/* Sticky Footer */}
        <div className="mt-auto border-t bg-[#f7f9fb] rounded-b-2xl border-gray-200 p-4">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="text-sm text-gray-500">Selected Items ({selectedItems.length})</div>
              <p className="text-lg font-bold">
                Total: ₱{total}/₱{budgetPerPerson} Budget
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Remaining Budget</div>
              <p className={cn("text-lg font-bold", isOverBudget ? "text-red-500" : "text-gray-800")}>
                {isOverBudget ? `(₱${Math.abs(remaining)} Over)` : `₱${remaining}`}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              disabled={selectedItems.length === 0 || isOverBudget}
              onClick={onSave}
              className="flex-1 bg-gradient-to-r from-[#0066FF] to-[#0052cc] text-white disabled:opacity-50"
            >
              Save Selection
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 