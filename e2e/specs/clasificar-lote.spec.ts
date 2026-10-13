import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, login, test } from "../support/test.ts";

const FIXTURE = path.join(__dirname, "../fixtures/lote.csv");

test("procesa un CSV, descarga los resultados y muestra el lote en el historial", async ({
  page,
}) => {
  await login(page);
  await page.goto("/clasificar");
  await page.getByRole("radio", { name: /Clasificador/ }).check();
  await page.getByRole("tab", { name: "Lote (CSV)" }).click();
  await page.getByLabel("Archivo CSV").setInputFiles(FIXTURE);

  const preview = page.getByRole("region", { name: "Vista previa" });
  await expect(preview).toContainText("10 filas, 9 válidas y 1 inválidas");
  await expect(preview.getByText("Inválida: Texto vacío")).toBeVisible();

  await page.getByRole("button", { name: /Clasificar 9 filas con Clasificador/ }).click();
  await expect(page.getByText(/Lote terminado/)).toBeVisible();
  await expect(page.getByText("9 clasificadas, 1 inválidas.")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar resultados (CSV)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("lote-resultados.csv");
  const bytes = await readFile(await download.path());
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const lines = bytes.subarray(3).toString("utf8").trimEnd().split("\r\n");
  expect(lines[0]).toBe("referencia;texto;categoria;motor;estado;error");
  const rows = lines.slice(1).map((line) => line.split(";"));
  expect(rows).toHaveLength(10);
  expect(rows.filter((row) => row[4] === "clasificada")).toHaveLength(9);
  expect(rows.find((row) => row[0] === "E2E-05")?.[4]).toBe("inválida");
  expect(rows.find((row) => row[0] === "E2E-06")?.[1]).toContain("José María Córdova");
  for (const row of rows.filter((row) => row[4] === "clasificada")) {
    expect(row[2]).toMatch(/^(Petición|Reclamo|Denuncia|Solicitud de información)$/);
    expect(row[3]).toBe("classifier");
  }

  await page.getByRole("link", { name: "Ver este lote en el historial" }).click();
  await expect(page).toHaveURL(/\/historial\?batch_id=[0-9a-f-]{36}$/);
  await expect(page.getByText("9 resultados")).toBeVisible();
  const tableRows = page.getByRole("table").getByRole("row");
  await expect(tableRows).toHaveCount(10); // encabezado + 9
  for (const row of await tableRows.all().then((all) => all.slice(1))) {
    await expect(row.getByRole("cell").nth(4)).toHaveText("Lote");
  }
});
