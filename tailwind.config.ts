import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./node_modules/@cloudflare/kumo/dist/chunks/{button-*,layer-card-*}.js",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        kumo: {
          brand: "var(--color-kumo-brand)",
          "brand-hover": "var(--color-kumo-brand-hover)",
          base: "var(--color-kumo-base)",
          elevated: "var(--color-kumo-elevated)",
          fill: "var(--color-kumo-fill)",
          tint: "var(--color-kumo-tint)",
          danger: "hsl(var(--destructive))",
          focus: "hsl(var(--ring))",
          hairline: "var(--color-kumo-hairline)",
          default: "var(--text-color-kumo-default)",
          subtle: "var(--text-color-kumo-subtle)",
        },
      },
      spacing: {
        "6.5": "1.625rem",
      },
      boxShadow: {
        xs: "0 1px 2px rgb(21 20 20 / 0.05)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
