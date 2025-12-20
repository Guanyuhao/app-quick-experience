import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default [
  // 忽略的文件和目录
  {
    ignores: [
      "node_modules/**",
      "build/**",
      ".cache/**",
      ".wrangler/**",
      "public/**",
      "*.config.js",
      "*.config.ts",
    ],
  },
  
  // JavaScript 基础规则
  js.configs.recommended,
  
  // TypeScript 和 React 配置
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // 浏览器全局变量
        document: "readonly",
        window: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        FormData: "readonly",
        // Web API
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        AbortController: "readonly",
        // React
        React: "readonly",
        JSX: "readonly",
        // Node
        process: "readonly",
        // Cloudflare Workers
        caches: "readonly",
        Env: "readonly",
        CacheStorage: "readonly",
        ExportedHandler: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react": react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      // TypeScript
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      
      // React
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      
      // 通用
      "no-unused-vars": "off", // 使用 TypeScript 版本
      "no-console": "off",
      "no-control-regex": "off", // 允许安全函数中使用控制字符正则
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
];
