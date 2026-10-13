import { isMock } from "../support/env.ts";
import { mockApi } from "../support/mock.ts";
import { expect, login, test } from "../support/test.ts";

test("cerrar sesión lleva a /login", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // La cookie ya no sirve: volver al panel redirige al login.
  await page.goto("/historial");
  await expect(page).toHaveURL(/\/login$/);
});

test("entrar a /historial sin sesión redirige a /login", async ({ page }) => {
  await page.goto("/historial");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
});

test("una sesión expirada redirige a /login?expirada=1", async ({ page }) => {
  test.skip(!isMock, "Simular la expiración necesita la API simulada.");
  await login(page);
  await page.goto("/clasificar");
  await page.getByRole("radio", { name: /Clasificador/ }).check();

  await mockApi.expireSessions();
  await page.getByLabel("Texto de la PQRS").fill("Solicito información sobre mi trámite");
  await page.getByRole("button", { name: "Clasificar", exact: true }).click();

  await expect(page).toHaveURL(/\/login\?expirada=1$/);
  await expect(page.getByText("Tu sesión expiró. Inicia sesión de nuevo.")).toBeVisible();
});
