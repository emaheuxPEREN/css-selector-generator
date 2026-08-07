import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    ignores: ["src/generated.ts"],
  },
  eslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      "no-console": "warn",
    },
  },
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["src/generate.ts"],
    languageOptions: {
      globals: {
        console: "readonly",
      },
    },
  },
];
