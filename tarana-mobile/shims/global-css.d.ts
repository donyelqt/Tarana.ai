/**
 * NativeWind's global.css import (index.ts) has no JS module. Metro resolves
 * it through the NativeWind transform; tsc needs the same declaration.
 */
declare module '*.css';
