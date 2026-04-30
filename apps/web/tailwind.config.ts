import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: "#17202a",
        proof: "#2563eb",
        signal: "#0f766e",
        ledger: "#7c3aed"
      }
    }
  },
  plugins: []
};

export default config;
