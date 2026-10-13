import { isMock } from "../support/env.ts";
import { mockApi } from "../support/mock.ts";
import { expect, login, parseCount, test, type Page } from "../support/test.ts";

/** Datos en los últimos 30 días: sembrados (mock) o clasificando un texto (API real). */
async function ensureData(page: Page) {
  if (isMock) {
    const now = Date.now();
    const hoursAgo = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
    await mockApi.seed([
      { created_at: hoursAgo(1), text: "a", category: "Reclamo", model: "classifier" },
      { created_at: hoursAgo(30), text: "b", category: "Reclamo", model: "llm" },
      { created_at: hoursAgo(60), text: "c", category: "Reclamo", model: "classifier" },
      { created_at: hoursAgo(80), text: "d", category: "Petición", model: "classifier" },
      { created_at: hoursAgo(24 * 10), text: "e", category: "Denuncia", model: "classifier" },
      // Fuera de los últimos 30 días: no cuenta en ninguno de los dos totales.
      { created_at: hoursAgo(24 * 45), text: "f", category: "Petición", model: "classifier" },
    ]);
    return;
  }
  await page.goto("/clasificar");
  await page.getByRole("radio", { name: /Clasificador/ }).check();
  await page.getByLabel("Texto de la PQRS").fill("Solicito el paz y salvo del impuesto predial");
  await page.getByRole("button", { name: "Clasificar", exact: true }).click();
  await expect(page.getByRole("region", { name: "Resultado" })).toBeVisible();
}

test("el total de Métricas coincide con el del Historial para el mismo período (E4)", async ({
  page,
}) => {
  await login(page);
  await ensureData(page);
  await page.goto("/metricas");

  const total = parseCount(await page.getByTestId("metrics-total").innerText());
  expect(total).toBeGreaterThan(0);
  if (isMock) expect(total).toBe(5);

  await page.getByRole("link", { name: "Ver en el historial" }).click();
  await expect(page).toHaveURL(
    /\/historial\?date_from=\d{4}-\d{2}-\d{2}&date_to=\d{4}-\d{2}-\d{2}$/,
  );
  const results = page.getByText(/^[\d.]+ resultados?$/);
  await expect(results).toBeVisible();
  expect(parseCount(await results.innerText())).toBe(total);
});

test("la barra de la categoría más frecuente coincide con la tarjeta", async ({ page }) => {
  await login(page);
  await ensureData(page);
  await page.goto("/metricas");

  const card = page.getByTestId("metrics-top-category");
  await expect(card).not.toHaveText("—");
  const topInCard = (await card.getByRole("listitem").allInnerTexts()).map((text) => text.trim());

  const chart = page.getByRole("figure", { name: "Clasificaciones por categoría" });
  await chart.getByRole("button", { name: "Ver como tabla" }).click();
  const rows = await chart.getByRole("row").all();
  const values: [string, number][] = [];
  for (const row of rows.slice(1)) {
    const [label, value] = await row.getByRole("cell").allInnerTexts();
    values.push([label!.trim(), parseCount(value!)]);
  }
  const max = Math.max(...values.map(([, value]) => value));
  const topInChart = values.filter(([, value]) => value === max).map(([label]) => label);

  expect(topInCard).toEqual(topInChart);
  if (isMock) expect(topInCard).toEqual(["Reclamo"]);
});
