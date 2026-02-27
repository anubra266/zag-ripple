import { ripple } from "@ripple-ts/vite-plugin"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [ripple()],
  test: {
    retry: 2,
    globals: true,
    environment: "jsdom",
    css: false,
  },
  resolve: {
    conditions: ["development", "browser"],
  },
})
