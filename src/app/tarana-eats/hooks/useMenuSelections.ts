import { useState, useEffect } from 'react';
import { MenuItem, ResultMatch } from '@/types/tarana-eats';
import { getMenuByRestaurantName, restaurants } from '../data/taranaEatsData';

export const useMenuSelections = (match: ResultMatch) => {
  const [selectedItems, setSelectedItems] = useState<MenuItem[]>([]);

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
      return Object.values(match.fullMenu)
        .flat()
        .filter(item => item); 
    }
    
    const fullMenu = getMenuByRestaurantName(match.name, restaurants);
    return Object.values(fullMenu).flat().filter(item => item);
  };

  return {
    selectedItems,
    toggleItem,
    getTotalPrice,
    getMenuItems
  };
};