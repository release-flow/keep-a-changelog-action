import typescriptEslint from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-plugin-prettier";
import jest from "eslint-plugin-jest";
import _import from "eslint-plugin-import";
import { fixupPluginRules } from "@eslint/compat";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: ["**/dist/", "**/lib/", "**/node_modules/", "**/jest.config.js"],
}, ...compat.extends("prettier"), {
    plugins: {
        "@typescript-eslint": typescriptEslint,
        prettier,
        jest,
        import: fixupPluginRules(_import),
    },

    languageOptions: {
        globals: {
            ...globals.node,
            ...jest.environments.globals.globals,
        },

        parser: tsParser,
    },

    settings: {
        "import/parsers": {
            "@typescript-eslint/parser": [".ts", ".tsx"],
        },

        "import/resolver": {
            typescript: {},
        },
    },

    rules: {
        "prettier/prettier": ["error", {
            endOfLine: "auto",
        }],

        "@typescript-eslint/indent": ["error", 2],
        "linebreak-style": ["error", "unix"],

        "max-len": ["error", {
            code: 120,
            comments: 120,
        }],

        "object-curly-newline": 0,
    },
}, ...compat.extends(
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier",
).map(config => ({
    ...config,
    files: ["**/*.ts"],
})), {
    files: ["**/*.ts"],

    languageOptions: {
        ecmaVersion: 9,
        sourceType: "module",

        parserOptions: {
            project: "./tsconfig.eslint.json",
        },
    },

    rules: {
        "no-unused-vars": "off",

        "@typescript-eslint/no-unused-vars": ["error", {
            argsIgnorePattern: "^_",
        }],

        "@typescript-eslint/no-non-null-assertion": "off",

        "import/no-extraneous-dependencies": ["error", {
            devDependencies: ["**/*.test.ts", "**/__tests__/**/*.ts"],
        }],

        "no-underscore-dangle": ["error", {
            allowAfterThis: true,
        }],

        "import/extensions": ["error", {
            ts: "ignorePackages",
        }],

        "no-plusplus": "off",
        "no-continue": "off",
    },
}, ...compat.extends(
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier",
).map(config => ({
    ...config,
    files: ["**/*.test.ts"],
})), {
    files: ["**/*.test.ts"],

    rules: {
        "prefer-arrow-callback": 0,
        "func-names": 0,
        "@typescript-eslint/no-non-null-assertion": 0,
        "no-unused-expressions": 0,
        "@typescript-eslint/unbound-method": "off",
        "jest/unbound-method": "error",
    },
}];