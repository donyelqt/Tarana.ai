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
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  {
    files: [
      "src/components/**/*.ts",
      "src/components/**/*.tsx",
      "src/app/**/*.ts",
      "src/app/**/*.tsx",
    ],
    ignores: [
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "src/app/api/**",
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
