// ====================================================================
// TARANA EATS DATA INDEX
// ====================================================================
//
// Central export file for all Tarana Eats data modules.
// Import everything from this file for convenience.
//
// ====================================================================

// Types
export * from "./types";

// Helpers
export * from "./helpers";

// Restaurant data
export { restaurants, allRestaurantMenus } from "./restaurants";

// Individual menus (for direct access)
export { goodShepherdCafeMenu } from "./menus/goodShepherdCafe";
export { myeongDongJjigaeMenu } from "./menus/myeongDongJjigae";
export { ohMyGulayMenu } from "./menus/ohMyGulay";
export { ujiMatchaCafeMenu } from "./menus/ujiMatchaCafe";
export { kFlavorsBuffetMenu } from "./menus/kFlavorsBuffet";

// AI data
export { combinedFoodData, savedMealExperiences, formOptionsData } from "./aiData";