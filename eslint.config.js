import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules/**", ".vercel/**", "coverage/**"],
  },
  js.configs.recommended,
  {
    files: ["*.js"],
    languageOptions: {
      globals: {
        console: "readonly",
        crypto: "readonly",
        document: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        Event: "readonly",
        window: "readonly",
      },
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: false,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "off"
    },
  }
);
