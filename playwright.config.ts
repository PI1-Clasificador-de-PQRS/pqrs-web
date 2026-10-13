import { defineConfig, devices } from "@playwright/test";
import {
  isMock,
  MOCK_API_PORT,
  MOCK_API_URL,
  MOCK_PROXY_SECRET,
  WEB_PORT,
  WEB_URL,
} from "./e2e/support/env.ts";

const CI = Boolean(process.env.CI);

/** El dashboard se prueba con su build de producción, configurado como en un despliegue. */
const webEnv = {
  ENVIRONMENT: "production",
  API_BASE_URL: isMock ? MOCK_API_URL : (process.env.API_BASE_URL ?? "http://localhost:8000"),
  PROXY_SHARED_SECRET: isMock
    ? MOCK_PROXY_SECRET
    : (process.env.PROXY_SHARED_SECRET ?? "dev-proxy-secret-solo-para-local"),
  // Con 1, Next pone la IP del socket en X-Forwarded-For y el proxy la toma de la derecha.
  WEB_TRUSTED_PROXY_HOPS: "1",
  PORT: String(WEB_PORT),
  HOSTNAME: "127.0.0.1",
};

const build = process.env.E2E_SKIP_BUILD ? "" : "pnpm build && ";

export default defineConfig({
  testDir: "./e2e/specs",
  // Las pruebas comparten la API (simulada o real): una a la vez.
  workers: 1,
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: WEB_URL,
    locale: "es-CO",
    // A propósito, una zona distinta de Bogotá: nada debe depender de la del navegador.
    timezoneId: "Europe/Madrid",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    ...(isMock
      ? [
          {
            command: "node e2e/mock-api/server.mts",
            url: `${MOCK_API_URL}/health`,
            env: { MOCK_API_PORT: String(MOCK_API_PORT), MOCK_PROXY_SECRET },
            reuseExistingServer: !CI,
            stdout: "pipe" as const,
          },
        ]
      : []),
    {
      command: `${build}node e2e/support/start-web.mjs`,
      url: `${WEB_URL}/api/health`,
      env: webEnv,
      timeout: 240_000,
      reuseExistingServer: !CI,
    },
  ],
});
