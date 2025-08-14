// ====================================================================
// TARANA EATS DATA - COMPATIBILITY LAYER
// ====================================================================
//
// This file maintains backward compatibility for existing imports.
// All data has been moved to modular files for better maintainability.
//
// NEW STRUCTURE:
// - /types.ts           - Type definitions
// - /helpers.ts         - Helper functions
// - /restaurants.ts     - Restaurant data and allRestaurantMenus
// - /menus/             - Individual restaurant menu files
// - /aiData.ts          - AI preparation data
// - /index.ts           - Central exports
//
// For new development, import from the modular files:
// import { restaurants, allRestaurantMenus } from './restaurants'
// import { combinedFoodData } from './aiData'
//
// ====================================================================

// Re-export everything from the new modular structure for backward compatibility
export * from "./types";
export * from "./helpers";
export * from "./restaurants";
export * from "./aiData";