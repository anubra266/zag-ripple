import { defineConfig } from "vite";
import { ripple } from "vite-plugin-ripple";

console.log({ env: process.env.NODE_ENV });

export default defineConfig({
  plugins: [ripple()],
  base: process.env.NODE_ENV === "production" ? "/zag-ripple/" : "/",
  server: {
    port: 3000,
  },
  build: {
    target: "esnext",
    outDir: "site-build",
  },
});
