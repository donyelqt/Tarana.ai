import { useState } from 'react';
import { MenuItem } from '@/types/tarana-eats';

export const useMenuSelections = () => {
  const [savedSelections, setSavedSelections] = useState<Record<string, MenuItem[]>>({});
  const [selectedItems, setSelectedItems] = useState<MenuItem[]>([]);
  const [activeRestaurant, setActiveRestaurant] = useState<string | null>(null);

  const selectRestaurant = (restaurantName: string) => {
    setActiveRestaurant(restaurantName);
    // Initialize selected items with any previously saved selections
    setSelectedItems(savedSelections[restaurantName] || []);
  };

  const closeMenu = () => {
    setActiveRestaurant(null);
    setSelectedItems([]);
  };

  const toggleMenuItem = (item: MenuItem) => {
    setSelectedItems((prev) =>
      prev.find((i) => i.name === item.name)
        ? prev.filter((i) => i.name !== item.name)
        : [...prev, item]
    );
  };

  const saveSelection = () => {
    if (activeRestaurant) {
      setSavedSelections(prev => ({ 
        ...prev, 
        [activeRestaurant]: [...selectedItems] 
      }));
      closeMenu();
    }
  };

  const calculateTotal = (items: MenuItem[]): number => {
    return items.reduce((sum, item) => sum + item.price, 0);
  };

  return {
    savedSelections,
    selectedItems,
    activeRestaurant,
    selectRestaurant,
    closeMenu,
    toggleMenuItem,
    saveSelection,
    calculateTotal,
  };
}; 