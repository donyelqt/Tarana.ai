# Tarana Eats Feature

This directory contains the Tarana Eats feature, which helps users find restaurant options and meals based on their preferences and budget, powered by AI.

## Directory Structure

```
src/app/tarana-eats/
├── components/               # UI components specific to Tarana Eats
│   ├── FoodMatchCard.tsx     # Card component for displaying a restaurant match
│   ├── MenuPopup.tsx         # Modal for selecting menu items
│   └── TaranaEatsForm.tsx    # Form for collecting user preferences
├── data/                     # Static data and constants
│   ├── taranaEatsData.ts     # Combined organized restaurant and menu data
│   ├── formOptions.tsx       # Form options like cuisine types, meal types
│   └── menuData.ts           # Legacy menu data for backward compatibility
├── hooks/                    # Custom React hooks
│   ├── useMenuSelections.ts  # Hook for managing menu selections
│   ├── useTaranaEatsAI.ts    # Hook for AI-powered recommendations
│   └── useTaranaEatsService.ts # Service hook for API interactions
├── test-menu-data.tsx        # Test component for exploring the menu data structure
└── page.tsx                  # Main page component
```

## Component Flow

1. User fills out preferences in `TaranaEatsForm`
2. Form data is sent to `useTaranaEatsAI` hook which calls the Gemini API
3. Gemini API analyzes preferences and provides personalized recommendations
4. Results are displayed in `FoodMatchesPreview` as `FoodMatchCard` components
5. User can click on a card to view the menu in `MenuPopup`
6. Selections are managed through `useMenuSelections` hook

## Data Organization

The `taranaEatsData.ts` file contains all restaurant and menu data in a well-organized format:

1. **Type Definitions**: FullMenu, RestaurantData, and MenuItemWithCategory interfaces
2. **Helper Functions**: getEmptyFullMenu(), getMenuByRestaurantName(), createFoodPrompt()
3. **Restaurant Menu Data**: Detailed menus for each restaurant organized by category
4. **Complete Restaurant Data**: Master array with all restaurant details
5. **Saved Meals & AI Data**: Data preparation for AI recommendations

### Menu Categories

Each restaurant menu is organized into these categories:
- Breakfast
- Lunch 
- Dinner
- Snacks
- Drinks

### Testing Menu Data

To explore the menu data structure, navigate to:
```
http://localhost:3000/tarana-eats/test-menu-data
```

## AI Integration

Tarana Eats is powered by Google's Gemini API for intelligent meal recommendations:

1. **Data Collection**: The `taranaEatsData.ts` file combines:
   - Restaurant data with categorized menus
   - User's saved meal history
   - Available form options
   
2. **AI Processing**:
   - User preferences are converted to a natural language prompt
   - The prompt and combined data are sent to the Gemini API
   - Gemini analyzes the data and returns personalized recommendations
   - Each recommendation includes a reason why it matches the user's preferences
   
3. **Fallback System**:
   - If the AI service is unavailable, the system falls back to rule-based recommendations
   - The fallback uses preference filters to match restaurants with user preferences

## API Endpoints

- `/api/gemini/food-recommendations` - Processes user preferences and returns AI-powered restaurant recommendations

## Scaling the Data

To add a new restaurant or menu items:

1. Edit the `taranaEatsData.ts` file
2. Create a new menu object following the existing format
3. Add an entry to the restaurants array with all the restaurant details
4. Add the restaurant to the allRestaurantMenus record

## Future Improvements

- Train a dedicated model with more Baguio restaurant data
- Add real-time restaurant availability
- Implement personalized recommendations based on user history
- Add image recognition for food photos
- Support multi-language prompts 