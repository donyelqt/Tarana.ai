/** @type {import('tailwindcss').Config} */
const { fontFamily } = require('tailwindcss/defaultTheme');

module.exports = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
      boxShadow: {
        '3xl': '0 35px 60px -15px, 0 0 20px 0px',
      },
  		colors: {
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			sans: [
  				'var(--font-general-sans)',
                    ...fontFamily.sans
                ]
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
        "4xl": "2rem",
		"5xl": "2.5rem",
		"6xl": "3rem",
		"7xl": "3.5rem"
  		},
  		keyframes: {
  			"accordion-down": {
  				from: { height: "0" },
  				to: { height: "var(--radix-accordion-content-height)" },
  			},
  			"accordion-up": {
  				from: { height: "var(--radix-accordion-content-height)" },
  				to: { height: "0" },
  			},
        "natural-shimmer": {
          '0%, 100%': { boxShadow: '0 0 35px 0px rgba(59, 130, 246, 0.5)' },
          '25%':      { boxShadow: '0 0 42px 3px rgba(59, 130, 246, 0.58)' },
          '50%':      { boxShadow: '0 0 45px 5px rgba(59, 130, 246, 0.6)' },
          '75%':      { boxShadow: '0 0 38px 2px rgba(59, 130, 246, 0.55)' },
        },
  			"fade-in": {
  				"0%": {
  					opacity: "0",
  					transform: "translateY(10px)",
  				},
  				"100%": {
  					opacity: "1",
  					transform: "translateY(0)",
  				},
  			},
        "pulse-ring": {
          "0%": {
            transform: "scale(0.8)",
            opacity: "1",
          },
          "80%, 100%": {
            transform: "scale(1.5)",
            opacity: "0",
          },
        },
        "reveal-and-pulse": {
          "0%": {
            opacity: "0",
            transform: "translateY(10px) scale(0.95)"
          },
          "37.5%": {
            opacity: "1",
            transform: "translateY(0px) scale(1.05)"
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0px) scale(0.95)"
          }
        }
  		},
  		animation: {
  			"accordion-down": "accordion-down 0.2s ease-out",
  			"accordion-up": "accordion-up 0.2s ease-out",
  			"fade-in": "fade-in 1.5s ease-in-out forwards",
        "natural-shimmer": "natural-shimmer 40s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite",
        "pulse-ring-delayed": "pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite 0.5s",
        "pulse-ring-delayed-more": "pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite 1s",
        "reveal-and-pulse": "reveal-and-pulse 4s ease-in-out infinite"
  		},
  	}
  },
  plugins: [require("tailwindcss-animate")],
};