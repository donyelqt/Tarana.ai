import { useState, useEffect } from 'react';
import { MenuItem, ResultMatch } from '@/types/tarana-eats';
import { getMenuByRestaurantName } from '../data/taranaEatsData';

export const useMenuSelections = (match: ResultMatch) => {
  const [selectedItems, setSelectedItems] = useState<MenuItem[]>([]);

  // Reset selections when restaurant changes
  useEffect(() => {
    setSelectedItems([]);
  }, [match.name]);

  const toggleItem = (item: MenuItem) => {
    setSelectedItems(prev => {
      const exists = prev.some(i => i.name === item.name);
      if (exists) {
        return prev.filter(i => i.name !== item.name);
      } else {
        return [...prev, item];
      }
    });
  };

  const getTotalPrice = () => {
    return selectedItems.reduce((sum, item) => sum + item.price, 0);
  };

  const getMenuItems = (match: ResultMatch): MenuItem[] => {
    if (match.fullMenu) {
      // Flatten all menu categories into a single array
      return Object.values(match.fullMenu)
        .flat()
        .filter(item => item); // Remove any undefined items
    }
    
    // Fallback: get menu by restaurant name from data store
    const fullMenu = getMenuByRestaurantName(match.name);
    return Object.values(fullMenu).flat().filter(item => item);
  };

  return {
    selectedItems,
    toggleItem,
    getTotalPrice,
    getMenuItems
  };
}; 