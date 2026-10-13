import { credentials } from "../support/env.ts";
import { expect, login, test } from "../support/test.ts";

test("contraseña incorrecta: mensaje genérico", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(credentials().email);
  await page.getByLabel("Contraseña").fill("una-clave-que-no-es");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "Correo o contraseña incorrectos." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("login correcto: llega a Métricas con el nombre de la organización", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { level: 1, name: "Métricas" })).toBeVisible();
});
