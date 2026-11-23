import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta oficial do CAEELA (docs/identidade/README.md)
        caeela: {
          azul: "#0A63C9",
          vivo: "#0070F0",
          verde: "#2EA84A",
          amarelo: "#F0C000",
          vermelho: "#B3261E",
          prefeitura: "#0060A8",
        },
      },
      minHeight: {
        // Alvo mínimo de toque de 44px (decisão do projeto)
        toque: "44px",
      },
      minWidth: {
        toque: "44px",
      },
    },
  },
  plugins: [],
};

export default config;
