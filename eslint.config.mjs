import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Todo texto de la API o del CSV se muestra como texto plano.
      "react/no-danger": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "src/lib/api/schema.d.ts"] },
];

export default config;
