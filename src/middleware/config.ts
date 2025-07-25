/**
 * Protected routes configuration
 * Any routes that start with these paths will require authentication
 */
export const protectedRoutes = [
  '/dashboard',
  '/itinerary-generator',
  '/saved-trips',
  '/profile',
  '/saved-meals',
  '/tarana-eats',
];

/**
 * Middleware configuration settings
 */
export const middlewareConfig = {
  // Logger middleware settings
  enableLogger: false, // Set to true to enable request logging
  
  // Rate limiting middleware settings (if implemented)
  rateLimit: {
    enable: false,
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },

  // Feature flags for middleware features
  features: {
    enableCSP: false, // Content Security Policy
    enableCORS: true, // Cross-Origin Resource Sharing
  },
}; 