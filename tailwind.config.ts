import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    {
      pattern: /^(bg-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|primary|rose|palepink|lila)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern: /^(text-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|primary|rose|palepink|lila)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern: /^(border-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|primary|rose|palepink|lila)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern: /^(ring-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|primary|rose|palepink|lila)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
    {
      pattern: /^(stroke-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|primary|rose|palepink|lila)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
    {
      pattern: /^(fill-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|primary|rose|palepink|lila)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          dark: "var(--primary-dark)",
          mid: "var(--primary-mid)",
          DEFAULT: "var(--primary-mid)", // Esto es clave
          500: "var(--primary-mid)",     // Tremor necesita explícitamente el 500
          light: "var(--primary-light)",
          pale: "var(--primary-pale)",
          soft: "var(--primary-soft)",
          50: "var(--primary-soft)",
        },
        // Actualiza la marca de Tremor para que use tu color primario en lugar de blue
        tremor: {
          brand: {
            faint: "var(--primary-soft)",
            muted: "var(--primary-light)",
            subtle: "var(--primary-mid)",
            DEFAULT: "var(--primary-mid)",
            emphasis: "var(--primary-dark)",
            inverted: "#ffffff",
          },
          // ... el resto de background, border, etc., déjalos como están
        },
      },

      boxShadow: {
        "tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "tremor-card": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "tremor-dropdown": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      },
      borderRadius: {
        "tremor-small": "0.375rem",
        "tremor-default": "0.5rem",
        "tremor-full": "9999px",
      },
      fontSize: {
        "tremor-label": ["0.75rem", { lineHeight: "1rem" }],
        "tremor-default": ["0.875rem", { lineHeight: "1.25rem" }],
        "tremor-title": ["1.125rem", { lineHeight: "1.75rem" }],
        "tremor-metric": ["1.875rem", { lineHeight: "2.25rem" }],
      },
    },
  },
  plugins: [],
};
export default config;
