import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "class-transformer": fileURLToPath(new URL("./node_modules/class-transformer", import.meta.url)),
      "crypto-js": fileURLToPath(new URL("./node_modules/crypto-js", import.meta.url)),
      "node-ipc": fileURLToPath(new URL("./node_modules/node-ipc", import.meta.url)),
      "reflect-metadata": fileURLToPath(new URL("./node_modules/reflect-metadata", import.meta.url)),
      "rxjs": fileURLToPath(new URL("./node_modules/rxjs", import.meta.url)),
      "uuid": fileURLToPath(new URL("./node_modules/uuid", import.meta.url)),
    },
  },
  build: {
    outDir: "dist/leapp-client",
    emptyOutDir: false,
    minify: mode === "production",
    sourcemap: mode !== "production",
  },
}));