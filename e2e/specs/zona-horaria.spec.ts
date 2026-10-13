import { isMock } from "../support/env.ts";
import { mockApi } from "../support/mock.ts";
import { expect, login, test } from "../support/test.ts";

test.skip(!isMock, "Necesita sembrar fechas: solo con la API simulada.");

// 01:00 UTC del 13 de octubre = 20:00 del 12 en Bogotá.
const CREATED_AT = "2026-10-13T01:00:00Z";

test.beforeEach(async ({ page }) => {
  await mockApi.seed([
    { created_at: CREATED_AT, text: "Sembrada a las 01:00 UTC", category: "Denuncia" },
  ]);
  await login(page);
});

test("aparece al filtrar el Historial por el 12, con hora 20:00", async ({ page }) => {
  await page.goto("/historial?date_from=2026-10-12&date_to=2026-10-12");
  await expect(page.getByText("1 resultado")).toBeVisible();
  const row = page.getByRole("row", { name: /Sembrada a las 01:00 UTC/ });
  await expect(row.getByRole("cell").first()).toHaveText(/^12 de oct\.? de 2026, 20:00$/);

  await page.goto("/historial?date_from=2026-10-13&date_to=2026-10-13");
  await expect(page.getByText("Ningún resultado con estos filtros.")).toBeVisible();
});

test("cuenta en el día 12 de la serie de Métricas", async ({ page }) => {
  await page.goto("/metricas?period=custom&date_from=2026-10-12&date_to=2026-10-13");
  await expect(page.getByTestId("metrics-total")).toHaveText("1");

  const series = page.getByRole("figure", { name: "Clasificaciones por día" });
  await series.getByRole("button", { name: "Ver como tabla" }).click();
  await expect(series.getByRole("row", { name: /^12 de oct\.? de 2026 1$/ })).toBeVisible();
  await expect(series.getByRole("row", { name: /^13 de oct\.? de 2026 0$/ })).toBeVisible();
});
