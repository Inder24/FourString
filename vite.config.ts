import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { createAdaptiveCoachMiddleware } from "./server/adaptive-coach-api";
import { createMistakeExplanationMiddleware } from "./server/mistake-explanation-api";
import { createLessonCoachMiddleware } from "./server/lesson-coach-api";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, ".", "");
  const adaptiveCoachApi = (): Plugin => ({
    name: "four-strings-adaptive-coach-api",
    configureServer(server) {
      server.middlewares.use(createAdaptiveCoachMiddleware(environment.OPENAI_API_KEY ?? ""));
      server.middlewares.use(createMistakeExplanationMiddleware(environment.OPENAI_API_KEY ?? ""));
      server.middlewares.use(createLessonCoachMiddleware(environment.OPENAI_API_KEY ?? ""));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createAdaptiveCoachMiddleware(environment.OPENAI_API_KEY ?? ""));
      server.middlewares.use(createMistakeExplanationMiddleware(environment.OPENAI_API_KEY ?? ""));
      server.middlewares.use(createLessonCoachMiddleware(environment.OPENAI_API_KEY ?? ""));
    },
  });

  return {
    plugins: [adaptiveCoachApi()],
    build: { outDir: 'dist/client' },
    server: {
      host: "127.0.0.1",
      port: 4173,
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
    },
    test: {
      include: ["src/**/*.test.ts"],
      coverage: {
        reporter: ["text"],
      },
    },
  };
});
