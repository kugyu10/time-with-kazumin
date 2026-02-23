import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["node_modules", ".claude", "supabase", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/lib/**/*.ts",
      ],
      exclude: [
        "node_modules/",
        ".next/",
        "supabase/",
        "*.config.*",
        "vitest.setup.ts",
        "src/lib/supabase/**",
        "src/lib/actions/**",
        "src/lib/bookings/saga.ts",
        "src/lib/bookings/cancel.ts",
        "src/lib/integrations/google-calendar.ts",
        "src/lib/integrations/oauth/**",
        "src/lib/integrations/email.ts",
        "src/lib/utils/idempotency.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
