import React, { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PlusIcon, CheckIcon, MinusIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/core";
import { ResultMatch, MenuItem } from "@/types/tarana-eats";
import { getMenuByRestaurantName, restaurants } from "../data/taranaEatsData";
import { useToast } from "@/components/ui/use-toast";

interface MenuItemWithQuantity extends MenuItem {
  quantity: number;
}

interface MenuPopupProps {
  match: ResultMatch;
  onClose: () => void;
  onSave: (selectedItems: MenuItem[]) => void;
}

export default function MenuPopup({ 
  match, 
  onClose, 
  onSave 
}: MenuPopupProps) {
  const [selectedItems, setSelectedItems] = useState<MenuItemWithQuantity[]>([]);
  const { toast } = useToast();
  
  // Get menu items from fullMenu if available, otherwise from MENU_DATA
  const getMenuItems = (): MenuItem[] => {
    if (match.fullMenu) {
      // Flatten all menu categories into a single array
      return Object.values(match.fullMenu)
        .flat()
        .filter(Boolean);
    }
    // Try to get from MENU_DATA
   // const menuItems = MENU_DATA[match.name];
    //if (menuItems && menuItems.length > 0) {
      //return menuItems;
    //}
    
    // Fallback: get menu by restaurant name
    const fullMenu = getMenuByRestaurantName(match.name, restaurants);
    return Object.values(fullMenu).flat().filter(Boolean);
  };

  // Helper to ensure valid image URL for next/image
  const getValidImageUrl = (imageUrl: string): string => {
    if (!imageUrl) return '/images/placeholders/hero-placeholder.svg';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('/')) {
      return imageUrl;
    }
    return `/${imageUrl}`;
  };
  const menuItems = getMenuItems();
  
  const addItem = (item: MenuItem) => {
    const existingItem = selectedItems.find(i => i.name === item.name);
    
    if (existingItem) {
      // Increase quantity
      setSelectedItems(prev => prev.map(i => 
        i.name === item.name ? { ...i, quantity: i.quantity + 1 } : i
      ));
      toast({
        title: "Quantity Increased",
        description: `${item.name} quantity: ${existingItem.quantity + 1}`,
        variant: "success",
      });
    } else {
      // Add new item with quantity 1
      setSelectedItems(prev => [...prev, { ...item, quantity: 1 }]);
      toast({
        title: "Item Added",
        description: `${item.name} added to your selection`,
        variant: "success",
      });
    }
  };
  
  const removeItem = (item: MenuItem) => {
    const existingItem = selectedItems.find(i => i.name === item.name);
    
    if (!existingItem) return;
    
    if (existingItem.quantity > 1) {
      // Decrease quantity
      setSelectedItems(prev => prev.map(i => 
        i.name === item.name ? { ...i, quantity: i.quantity - 1 } : i
      ));
      toast({
        title: "Quantity Decreased",
        description: `${item.name} quantity: ${existingItem.quantity - 1}`,
        variant: "default",
      });
    } else {
      // Remove item completely
      setSelectedItems(prev => prev.filter(i => i.name !== item.name));
      toast({
        title: "Item Removed",
        description: `${item.name} removed from your selection`,
        variant: "destructive",
      });
    }
  };
  
  const getTotalPrice = () => {
    return selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };
  
  const total = getTotalPrice();
  // match.price is already the total budget for the entire group, not per person
  const totalBudget = match.price;
  const remaining = totalBudget - total;
  const isOverBudget = remaining < 0;

  // DEBUG LOGGING - Remove after fixing
  console.log("🔍 MENUPOPP DEBUG:", {
    restaurantName: match.name,
    matchPrice: match.price,
    totalBudget: totalBudget,
    selectedItemsTotal: total,
    remainingBudget: remaining,
    groupSize: match.meals
  });

  const handleSave = () => {
    if (selectedItems.length === 0) {
      toast({
        title: "Missing Selection",
        description: "Please select at least one menu item",
        variant: "destructive",
      });
      return;
    }
    
    if (isOverBudget) {
      toast({
        title: "Over Budget",
        description: `Your selection exceeds your budget by ₱${Math.abs(remaining)}`,
        variant: "destructive",
      });
      return;
    }
    
    onSave(selectedItems);
    toast({
      title: "Selection Saved",
      description: `${selectedItems.length} items selected for ${match.name}`,
      variant: "success",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative mx-auto flex w-full max-w-xl flex-col max-h-[90vh] rounded-2xl bg-white">
        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-start gap-4">
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full">
              <Image
                src={getValidImageUrl(match.image)}
                alt={match.name}
                fill
                sizes="48px"
                className="object-cover"
              />
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight">{match.name}</h2>
              <p className="text-sm text-gray-500">
                Total budget: ₱{totalBudget} for {match.meals} {match.meals === 1 ? "person" : "people"}
              </p>
            </div>
          </div>

          {/* Menu List */}
          <div className="space-y-3">
            {menuItems.map((item, index) => {
              const selectedItem = selectedItems.find(i => i.name === item.name);
              const quantity = selectedItem?.quantity || 0;
              const isSelected = quantity > 0;
              
              return (
                <div
                  key={`${item.name}-${index}`}
                  className="flex items-center gap-3 rounded-xl border p-3 shadow-sm"
                >
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={getValidImageUrl(item.image || match.image)}
                      alt={item.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-sm text-gray-500">{item.description}</div>
                    <div className="mt-1 text-sm font-medium">₱{item.price} {quantity > 0 && <span className="text-blue-600">× {quantity}</span>}</div>
                  </div>
                  
                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <Button
                        onClick={() => removeItem(item)}
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg border-gray-300"
                      >
                        <MinusIcon className="h-4 w-4" />
                      </Button>
                    )}
                    
                    {isSelected && (
                      <div className="flex items-center justify-center min-w-[2rem] h-8 px-2 font-semibold text-sm bg-blue-50 text-blue-700 rounded-lg">
                        {quantity}
                      </div>
                    )}
                    
                    <Button
                      onClick={() => addItem(item)}
                      className={cn(
                        "h-8 rounded-lg text-sm font-medium flex items-center justify-center",
                        isSelected
                          ? "w-8 bg-gradient-to-r from-[#0066FF] to-[#0052cc] text-white hover:opacity-90"
                          : "px-4 gap-1 bg-gradient-to-r from-[#0066FF] to-[#0052cc] text-white hover:opacity-90"
                      )}
                    >
                      <PlusIcon className="h-4 w-4 shrink-0" />
                      {!isSelected && <span>Add</span>}
                    </Button>
                  </div>
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
                Total: ₱{total}/₱{totalBudget} Budget
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
              onClick={handleSave}
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