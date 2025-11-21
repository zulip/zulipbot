import { defineConfig } from "eslint/config";
import xo from "eslint-config-xo";
import importPlugin from "eslint-plugin-import";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import unicorn from "eslint-plugin-unicorn";

export default defineConfig(
  {
    ignores: ["package-lock.json"],
  },
  xo,
  importPlugin.flatConfigs.recommended,
  unicorn.configs.recommended,
  prettierRecommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
    },
    settings: {
      "import/resolver": "typescript",
    },
    rules: {
      "@stylistic/curly-newline": "off", // https://github.com/prettier/eslint-config-prettier/issues/351
      "arrow-body-style": "error",
      "capitalized-comments": "off",
      curly: ["error", "multi-line", "consistent"],
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-cycle": "error",
      "import/no-useless-path-segments": "error",
      "import/order": [
        "error",
        { alphabetize: { order: "asc" }, "newlines-between": "always" },
      ],
      "max-nested-callbacks": ["error", 3],
      "max-params": ["error", 5],
      "no-await-in-loop": "off",
      "no-useless-constructor": "error",
      "no-var": "error",
      "object-shorthand": ["error", "consistent-as-needed"],
      "prefer-arrow-callback": "error",
      "prefer-destructuring": ["error", { array: true, object: false }],
      "prefer-const": "error",
      "prefer-template": "error",
      strict: "error",
      "unicorn/no-null": "off",
      "unicorn/no-process-exit": "off",
      "unicorn/numeric-separators-style": "off",
      "unicorn/prefer-node-protocol": "off",
      "unicorn/prevent-abbreviations": [
        "error",
        { replacements: { args: false } },
      ],
      camelcase: ["off", {}],
    },
  },
  {
    files: ["**/*.json"],
    rules: {
      "unicorn/expiring-todo-comments": "off",
      strict: "off",
    },
  },
);
