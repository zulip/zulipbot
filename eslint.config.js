import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";
import xo from "eslint-config-xo";

export default defineConfig(
  {
    ignores: ["package-lock.json"],
  },
  xo({
    prettier: "compat",
  }),
  prettier,
  {
    files: ["**/*.{,[cm]}[jt]s"],
    languageOptions: {
      ecmaVersion: "latest",
    },
    rules: {
      "@typescript-eslint/naming-convention": "off",
      "@typescript-eslint/no-restricted-types": "off",
      "arrow-body-style": "error",
      "capitalized-comments": "off",
      curly: ["error", "multi-line", "consistent"],
      "jsdoc/require-asterisk-prefix": ["error", "always"],
      "max-params": ["error", 5],
      "no-await-in-loop": "off",
      "no-useless-constructor": "error",
      "prefer-arrow-callback": "error",
      "prefer-destructuring": ["error", { array: true, object: false }],
      "prefer-const": "error",
      "prefer-template": "error",
      strict: "error",
      "unicorn/no-break-in-nested-loop": "off",
      "unicorn/no-process-exit": "off",
      "unicorn/numeric-separators-style": "off",
      "unicorn/prevent-abbreviations": [
        "error",
        { replacements: { args: false } },
      ],
      "unicorn/require-array-sort-compare": "off", // https://github.com/xojs/eslint-config-xo/issues/104
    },
  },
);
