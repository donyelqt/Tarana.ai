import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "prefer-const": "off",
      "react/no-unescaped-entities": "off",
      "no-restricted-imports": "off",
      "@typescript-eslint/no-this-alias": "off",
      "import/no-anonymous-default-export": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "prefer-const": "off",
      "react/no-unescaped-entities": "off",
      "no-restricted-imports": "off",
      "@typescript-eslint/no-this-alias": "off",
      "import/no-anonymous-default-export": "off"
    }
  },
  {
    files: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
  {
    files: [
      "src/components/**/*.ts",
      "src/components/**/*.tsx",
      "src/app/**/*.ts",
      "src/app/**/*.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/traffic", "@/lib/traffic/tomtomTraffic"],
              message:
                "UI components must not import tomtomTrafficService directly - use a service-layer abstraction or hook.",
              importNames: ["tomtomTrafficService"],
            },
          ],
        },
      ],
    },
  }
];

export default eslintConfig;
