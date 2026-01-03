# Route Optimization Bug Fix

## Issue Description
Users experienced an issue where generating a second optimal route caused the previous optimal route (specifically alternative routes) to persist on the map, leading to a cluttered visual state where "ghost" routes remained visible.

## Root Cause Analysis
The issue was identified in the `InteractiveRouteMap.tsx` component's `useEffect` cleanup logic.

1.  **State Management**: The component renders route layers (primary and alternatives) onto the TomTom map instance.
2.  **Cleanup Failure**: The cleanup logic relied on iterating through the *current* `alternativeRoutes` array to determine which layers to remove.
    ```typescript
    alternativeRoutes.forEach((_, index) => {
      layersToRemove.push(`route-alt-${index}`, ...);
    });
    ```
3.  **The Bug**: When the number of alternative routes decreased (e.g., from 3 to 1), the cleanup loop would only iterate 1 time (based on the new prop value captured in the closure or depending on how the effect cycle managed the variable). If it iterated based on the *new* smaller length, it failed to identify and remove the higher-index layers (e.g., indices 1 and 2) that were previously rendered.

## Solution Implemented
A `useRef` based tracking mechanism was implemented to explicitly track the number of plotted alternative routes across renders.

1.  **Tracking State**: Added `plottedRouteCountRef` to track how many alternative route layers were actually added to the map in the previous render.
2.  **Robust Cleanup**: Modified the cleanup logic to iterate up to the maximum of `alternativeRoutes.length` (prop) and `plottedRouteCountRef.current` (tracked state). This ensures that even if the new route list is shorter, the cleanup logic accounts for and removes all previously rendered layers.

```typescript
// Fix Logic
const maxRouteCount = Math.max(alternativeRoutes.length, plottedRouteCountRef.current);

for (let index = 0; index < maxRouteCount; index++) {
  // Remove layer `route-alt-${index}`
}
```

## Verification
-   **Scenario 1 (3 routes -> 1 route)**: Cleanup now iterates 3 times (based on ref), correctly removing all 3 previous layers before adding the 1 new layer.
-   **Scenario 2 (1 route -> 3 routes)**: Cleanup iterates 1 time (based on ref), removing the old layer, then adds 3 new layers.
-   **Scenario 3 (Same count)**: Cleanup works as standard.

This ensures the map state remains consistent with the application state, eliminating ghost routes.
