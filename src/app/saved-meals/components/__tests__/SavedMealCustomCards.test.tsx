import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import SavedMealCustomCards from '../SavedMealCustomCards';

const combinedSavedMeals = [
  {
    cafeName: 'Oh My Gulay',
    type: 'Dinner',
    totalPrice: '450',
    goodFor: '6',
    items: [
      { name: "Bonifacio's Waldofesto", price: 225, quantity: 1 },
      { name: 'KKK Sliders', price: 225, quantity: 1 },
    ],
  },
];

const individualSavedMeals = [
  {
    id: 'meal-2',
    mealType: 'Breakfast',
    price: '675',
    goodFor: '6',
    items: [
      { name: 'Pancit Gulay Ni Pepe', price: 225, quantity: 1 },
      { name: 'KKK Sliders', price: 225, quantity: 1 },
    ],
  },
  {
    id: 'meal-3',
    mealType: 'Dinner',
    price: 1125,
    goodFor: '6',
    items: [
      { name: 'Bandilang Pula', price: 225, quantity: 2 },
    ],
  },
];

function renderSection(overrides: Partial<React.ComponentProps<typeof SavedMealCustomCards>> = {}) {
  const onViewMealCard = jest.fn();
  const onDeleteCombinedMeal = jest.fn();
  const onDeleteIndividualMeal = jest.fn();

  const result = render(
    <SavedMealCustomCards
      combinedSavedMeals={combinedSavedMeals}
      individualSavedMeals={individualSavedMeals}
      selectedMealId="custom-meal-1"
      onViewMealCard={onViewMealCard}
      onDeleteCombinedMeal={onDeleteCombinedMeal}
      onDeleteIndividualMeal={onDeleteIndividualMeal}
      {...overrides}
    />
  );

  return { ...result, onViewMealCard, onDeleteCombinedMeal, onDeleteIndividualMeal };
}

describe('SavedMealCustomCards — dense meal cards', () => {
  it('shows the card count and assigns selected state to the combined card', () => {
    renderSection();

    expect(screen.getByRole('heading', { name: 'Your Saved Meals' })).toBeTruthy();
    expect(screen.getByText('3 cards')).toBeTruthy();
    expect(screen.getByText('Selected').closest('article')?.getAttribute('aria-current')).toBe('true');
  });

  it('builds the exact combined View Meal Card payload', () => {
    const { onViewMealCard } = renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'View saved meal card 1' }));

    expect(onViewMealCard).toHaveBeenCalledWith({
      id: 'custom-meal-1',
      type: 'Combined',
      items: [
        { name: "Bonifacio's Waldofesto", price: 225, quantity: 1 },
        { name: 'KKK Sliders', price: 225, quantity: 1 },
      ],
      totalPrice: 450,
      goodFor: 6,
    });
  });

  it('numbers individuals from 2 when a combined card exists', () => {
    renderSection();

    expect(screen.getByRole('heading', { name: 'Custom Meal 2' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Custom Meal 3' })).toBeTruthy();
  });

  it('numbers individuals from 1 when there is no combined card', () => {
    renderSection({ combinedSavedMeals: [] });

    expect(screen.getByRole('heading', { name: 'Custom Meal 1' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Custom Meal 2' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Custom Meal 3' })).toBeNull();
  });

  it('calls the individual and combined delete callbacks with the expected ids', () => {
    const { onDeleteIndividualMeal, onDeleteCombinedMeal } = renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'Delete saved meal 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete saved meal 1' }));

    expect(onDeleteIndividualMeal).toHaveBeenCalledWith('meal-2');
    expect(onDeleteCombinedMeal).toHaveBeenCalledTimes(1);
  });

  it('renders the empty state with a link to Tarana Eats', () => {
    renderSection({ combinedSavedMeals: null, individualSavedMeals: null });

    expect(screen.getByRole('heading', { name: 'No meal cards yet' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Find meals' })).toBeTruthy();
  });
});
