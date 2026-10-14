const { defineConfig } = require("eslint/config");
const expo = require("eslint-config-expo/flat");
module.exports = defineConfig([
  expo,
  { ignores: ["dist/**", "dist-*/**", "src/editor/generated/**", ".expo/**"] },
  {
    files: ["src/editor/engine.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
]);
