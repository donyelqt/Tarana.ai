/**
 * Mobile Tailwind config — references, not a fork of, the web design system.
 *
 * Source of truth lives in the repo root: `tailwind.config.js` (token names)
 * and `src/app/globals.css` (`:root` HSL values). NativeWind needs static
 * color values (it cannot resolve `hsl(var(--...))` at runtime), so the
 * values below are the HSL tokens resolved to hex approximations. If the
 * brand changes, update these to match `:root` — do not invent new tokens.
 */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand blue (auth truth #0066FF — NOT the web theme default).
        // NativeWind compiles these statically; global.css :root values
        // are documentation for web-export, not runtime for utilities.
        primary: { DEFAULT: '#0066FF', foreground: '#f8fafc' },
        // --secondary / --accent: 210 40% 96.1% / fg 222.2 47.4% 11.2%
        secondary: { DEFAULT: '#f1f5f9', foreground: '#0f172a' },
        accent: { DEFAULT: '#f1f5f9', foreground: '#0f172a' },
        background: '#F2F2F7',
        foreground: '#020817',
        card: { DEFAULT: '#ffffff', foreground: '#0f172a' },
        popover: { DEFAULT: '#ffffff', foreground: '#0f172a' },
        // --muted-foreground: 215.4 16.3% 46.9%
        muted: { DEFAULT: '#f1f5f9', foreground: '#64748b' },
        // --destructive: 0 84.2% 60.2%
        destructive: { DEFAULT: '#ef4444', foreground: '#f8fafc' },
        // --border / --input: 214.3 31.8% 91.4%
        border: '#e2e8f0',
        input: '#e2e8f0',
        // --ring: 221.2 83.2% 53.3%
        ring: '#2563eb',
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      },
    },
  },
  plugins: [],
};
