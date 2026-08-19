/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Manrope', 'system-ui', 'sans-serif'],
        body: ['Figtree', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      colors: {
        sand: '#F7F4F0',
        clay: { DEFAULT: '#E06D53', dark: '#C8583F' },
        forest: { DEFAULT: '#2C5545', dark: '#1F3F32' },
        honey: '#F4A261',
        ink: '#1C221F',
        slate2: '#5C6460',
        line: '#E8E2D9',
        leaf: '#5B8266',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      boxShadow: {
        warm: '0 8px 30px rgba(44,85,69,0.08)',
        warmlg: '0 18px 50px rgba(44,85,69,0.14)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgba(224,109,83,0.5)' }, '70%': { boxShadow: '0 0 0 12px rgba(224,109,83,0)' }, '100%': { boxShadow: '0 0 0 0 rgba(224,109,83,0)' } },
        'marquee': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'slide-up': 'slide-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'pulse-ring': 'pulse-ring 2s infinite',
        'marquee': 'marquee 22s linear infinite',
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};
