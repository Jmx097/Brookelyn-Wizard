// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to root-level server.ts (our SSR error wrapper).
// This repo currently uses a flattened root layout rather than src/.
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  nitro: {
    preset: "vercel",
  },
  vite: {
    resolve: {
      alias: {
        "@": `${process.cwd()}`,
      },
    },
  },
  tanstackStart: {
    srcDirectory: ".",
    router: {
      entry: "router",
      routesDirectory: "./routes",
      generatedRouteTree: "./routeTree.gen.ts",
    },
    server: { entry: "server" },
    start: { entry: "start" },
  },
});
