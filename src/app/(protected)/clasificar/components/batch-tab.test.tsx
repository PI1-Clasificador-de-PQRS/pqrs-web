import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import type { BatchRequest } from "@/lib/batch/batch-machine";
import { model, renderWithQuery } from "@/test/render";
import { PROXY, server } from "@/test/msw/server";
import { ClassifyView } from "./classify-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

function csvFile(content: string, name = "pqrs.csv") {
  return new File([new TextEncoder().encode(content)], name, { type: "text/csv" });
}

describe("pestaña Lote", () => {
  beforeEach(() => {
    server.use(
      http.get(`${PROXY}/models`, () =>
        HttpResponse.json([
          model({ id: "llm", available: false, reason: "not_configured" }),
          model({ id: "classifier" }),
        ]),
      ),
    );
  });

  it("carga el CSV, muestra la vista previa, fija el motor durante el lote y permite descargar", async () => {
    const requests: BatchRequest[] = [];
    server.use(
      http.post(`${PROXY}/classify/batch`, async ({ request }) => {
        const body = (await request.json()) as BatchRequest;
        requests.push(body);
        await delay(20);
        return HttpResponse.json({
          batch_id: body.batch_id,
          model: body.model,
          results: body.items.map((_, index) => ({ index, category: "Reclamo" })),
        });
      }),
    );
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:resultados");
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();

    const user = userEvent.setup();
    renderWithQuery(<ClassifyView />);
    await vi.waitFor(() =>
      expect(screen.getByRole("radio", { name: /Clasificador/ })).toBeChecked(),
    );
    await user.click(screen.getByRole("tab", { name: "Lote (CSV)" }));
    await user.upload(
      screen.getByLabelText("Archivo CSV"),
      csvFile("Texto;Referencia\nEl servicio fue malo;R-1\n;R-2\n=1+1;R-3\n"),
    );

    const preview = await screen.findByRole("region", { name: "Vista previa" });
    expect(preview).toHaveTextContent("3 filas, 2 válidas y 1 inválidas");
    expect(within(preview).getByText("Inválida: Texto vacío")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Clasificar 2 filas con Clasificador/ }));
    expect(screen.getByRole("radio", { name: /Clasificador/ })).toBeDisabled();

    expect(await screen.findByText(/Lote terminado/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Clasificador/ })).toBeEnabled();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      model: "classifier",
      items: [
        { text: "El servicio fue malo", external_ref: "R-1" },
        { text: "=1+1", external_ref: "R-3" },
      ],
    });
    expect(requests[0]!.batch_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(screen.getByRole("link", { name: "Ver este lote en el historial" })).toHaveAttribute(
      "href",
      `/historial?batch_id=${requests[0]!.batch_id}`,
    );

    await user.click(screen.getByRole("button", { name: "Descargar resultados (CSV)" }));
    const blob = createObjectURL.mock.calls[0]![0];
    const content = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await blob.arrayBuffer());
    expect(content).toContain("﻿referencia;texto;categoria;motor;estado;error");
    expect(content).toContain("R-3;'=1+1;Reclamo;classifier;clasificada;");
  });

  it("rechaza un archivo sin la columna texto con un mensaje claro", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ClassifyView />);
    await user.click(screen.getByRole("tab", { name: "Lote (CSV)" }));
    await user.upload(screen.getByLabelText("Archivo CSV"), csvFile("asunto,ref\nHola,1\n"));
    expect(await screen.findByText(/no tiene la columna «texto»/)).toBeInTheDocument();
  });
});
