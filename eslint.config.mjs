import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-online/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Leitor de PDF copiado do pdf.js (código de terceiros, já minificado).
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;
