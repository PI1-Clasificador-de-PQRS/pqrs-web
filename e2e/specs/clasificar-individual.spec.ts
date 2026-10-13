import { isMock } from "../support/env.ts";
import { expect, login, test } from "../support/test.ts";

test("clasifica un texto con el clasificador y enlaza al detalle", async ({ page }) => {
  await login(page);
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Clasificar" })
    .click();

  const llm = page.getByRole("radio", { name: /LLM/ });
  const classifier = page.getByRole("radio", { name: /Clasificador/ });
  if (isMock) {
    await expect(llm).toBeDisabled();
    await expect(page.getByText("No configurado")).toBeVisible();
    await expect(classifier).toBeChecked();
  }
  await classifier.check();

  const text = "Solicito una copia del certificado de estratificación de mi vivienda";
  await page.getByLabel("Texto de la PQRS").fill(text);
  await page.getByRole("button", { name: "Clasificar", exact: true }).click();

  const result = page.getByRole("region", { name: "Resultado" });
  await expect(result).toContainText(/Petición|Reclamo|Denuncia|Solicitud de información/);
  await expect(result).toContainText("Clasificador");
  if (isMock) await expect(result).toContainText("Petición");

  await result.getByRole("link", { name: "Ver el detalle en el historial" }).click();
  await expect(page).toHaveURL(/\/historial\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Detalle de la clasificación" })).toBeVisible();
  await expect(page.getByText("Individual", { exact: true })).toBeVisible();
  await expect(page.getByText("Clasificador local", { exact: true })).toBeVisible();
});
