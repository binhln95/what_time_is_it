import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  // Port 8080 is whitelisted in Cognito callback URLs and API CORS (template.yaml)
  server: { port: 8080, strictPort: true },
  preview: { port: 8080, strictPort: true },
})
