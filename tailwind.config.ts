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
      pattern: /^(bg-(?:chart1|chart2|chart3|chart4|chart5|chart6|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|primary|rose|palepink|lila)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern: /^(text-(?:chart1|chart2|chart3|chart4|chart5|chart6|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|primary|rose|palepink|lila)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern: /^(border-(?:chart1|chart2|chart3|chart4|chart5|chart6|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|primary|rose|palepink|lila)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern: /^(ring-(?:chart1|chart2|chart3|chart4|chart5|chart6|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|primary|rose|palepink|lila)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
    {
      pattern: /^(stroke-(?:chart1|chart2|chart3|chart4|chart5|chart6|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|primary|rose|palepink|lila)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
    {
      pattern: /^(fill-(?:chart1|chart2|chart3|chart4|chart5|chart6|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|primary|rose|palepink|lila)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
  ],
  theme: {
    extend: {
      colors: {
        chart1: { 500: "rgb(var(--chart-1))" },
        chart2: { 500: "rgb(var(--chart-2))" },
        chart3: { 500: "rgb(var(--chart-3))" },
        chart4: { 500: "rgb(var(--chart-4))" },
        chart5: { 500: "rgb(var(--chart-5))" },
        chart6: { 500: "rgb(var(--chart-6))" },
        // Tremor SOLO reconoce colores estándar de Tailwind (pink, rose, etc.).
        // Sobreescribimos "pink" con las variables del tema activo para que
        // los componentes internos de Tremor sigan la marca sin hardcodear hex.
        pink: {
          50: "var(--primary-soft)",
          100: "var(--primary-pale)",
          200: "var(--primary-pale)",
          300: "var(--primary-light)",
          400: "var(--primary-light)",
          500: "var(--primary-mid)",
          600: "var(--primary-mid)",
          700: "var(--primary-dark)",
          800: "var(--primary-dark)",
          900: "var(--primary-dark)",
          950: "var(--primary-dark)",
        },
        tremor: {
          brand: {
            faint: "var(--primary-soft)",
            muted: "var(--primary-pale)",
            subtle: "var(--primary-light)",
            DEFAULT: "var(--primary-mid)",
            emphasis: "var(--primary-dark)",
            inverted: "var(--on-primary)",
          },
          background: {
            muted: "var(--bg-card2)",
            subtle: "var(--bg-card2)",
            DEFAULT: "var(--bg-card)",
            emphasis: "var(--text-main)",
          },
          border: {
            DEFAULT: "var(--border-primary)",
          },
          ring: {
            DEFAULT: "var(--border-primary)",
          },
          content: {
            subtle: colors.gray[400],
            DEFAULT: "var(--text-main)",
            emphasis: "var(--text-main)",
            strong: "var(--text-main)",
            inverted: "var(--bg-card2)",
          },
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
