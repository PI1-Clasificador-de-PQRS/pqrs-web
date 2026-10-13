import { expect, test as base, type Page } from "@playwright/test";
import { credentials, isMock } from "./env.ts";
import { mockApi } from "./mock.ts";

/**
 * `test` del E2E. En modo `mock` reinicia la API simulada antes de cada prueba y, al terminar,
 * exige que no haya fallos de cabeceras del proxy (secreto, CSRF, X-API-Key, `tz`), aunque la
 * interfaz los haya ocultado.
 */
export const test = base.extend<{ mockState: void }>({
  mockState: [
    async ({}, use) => {
      if (isMock) await mockApi.reset();
      await use();
      if (isMock) expect(await mockApi.violations()).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
export type { Page };

export async function login(page: Page) {
  const { email, password, organization } = credentials();
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/metricas$/);
  await expect(page.getByRole("banner")).toContainText(organization);
}

/** «1 resultado» / «1.234 resultados» → número. */
export function parseCount(text: string): number {
  return Number(text.replace(/[^\d]/g, ""));
}
