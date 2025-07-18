# Tarana Eats Feature

This directory contains the Tarana Eats feature, which helps users find restaurant options and meals based on their preferences and budget.

## Directory Structure

```
src/app/tarana-eats/
├── components/               # UI components specific to Tarana Eats
│   ├── FoodMatchCard.tsx     # Card component for displaying a restaurant match
│   ├── FoodMatchesPreview.tsx # Component to display all food matches
│   ├── MenuPopup.tsx         # Modal for selecting menu items
│   └── TaranaEatsForm.tsx    # Form for collecting user preferences
├── data/                     # Static data and constants
│   ├── formOptions.tsx       # Form options like cuisine types, meal types
│   └── menuData.ts           # Sample menu data for restaurants
├── hooks/                    # Custom React hooks
│   ├── useMenuSelections.ts  # Hook for managing menu selections
│   └── useTaranaEatsService.ts # Service hook for API interactions
├── types/                    # TypeScript type definitions
│   └── types.ts              # Type definitions for the feature
└── page.tsx                  # Main page component
```

## Component Flow

1. User fills out preferences in `TaranaEatsForm`
2. Form data is submitted to `useTaranaEatsService` which handles API interactions
3. Results are displayed in `FoodMatchesPreview` as `FoodMatchCard` components
4. User can click on a card to view the menu in `MenuPopup`
5. Selections are managed through `useMenuSelections` hook

## Types

- `MenuItem`: Represents a food item on a menu
- `ResultMatch`: Represents a restaurant match
- `TaranaEatsFormValues`: Form values for user preferences
- `FoodMatchesData`: Data structure for API response

## Future Improvements

- Add server-side API integration
- Implement user authentication for saving preferences
- Add actual restaurant data and menus
- Add ability to filter and sort results
- Implement a proper backend service for restaurant recommendations 