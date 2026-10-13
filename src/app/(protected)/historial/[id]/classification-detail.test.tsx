import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { PROXY, server } from "@/test/msw/server";
import { renderWithQuery } from "@/test/render";
import { ClassificationDetail } from "./classification-detail";

const ID = "0b9d6c58-4d6f-4f7e-9d8e-3c1d2e0f9a11";
const BATCH = "5f0a7c2e-1111-4a2b-9c3d-123456789abc";

describe("detalle de una clasificación", () => {
  it("muestra todos los campos y enlaza al lote", async () => {
    server.use(
      http.get(`${PROXY}/classifications/${ID}`, () =>
        HttpResponse.json({
          id: ID,
          text_anonymized: "Solicito copia de <b>[DOCUMENTO]</b>",
          category: "Petición",
          model: "llm",
          model_version: "llm-2026-09",
          source: "ui_batch",
          external_ref: "R-7",
          batch_id: BATCH,
          created_at: "2026-10-13T01:00:00Z",
        }),
      ),
    );
    renderWithQuery(<ClassificationDetail id={ID} />);

    // Texto plano: las etiquetas HTML se ven tal cual.
    expect(await screen.findByText("Solicito copia de <b>[DOCUMENTO]</b>")).toBeInTheDocument();
    expect(screen.getByText("Petición")).toBeInTheDocument();
    expect(screen.getByText("LLM")).toBeInTheDocument();
    expect(screen.getByText("llm-2026-09")).toBeInTheDocument();
    expect(screen.getByText("Origen").nextElementSibling).toHaveTextContent("Lote");
    expect(screen.getByText("R-7")).toBeInTheDocument();
    expect(screen.getByText(/12 de oct.* 20:00/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver todas las clasificaciones de este lote" }),
    ).toHaveAttribute("href", `/historial?batch_id=${BATCH}`);
  });

  it("un 404 se muestra como «No encontramos esta clasificación»", async () => {
    server.use(
      http.get(`${PROXY}/classifications/${ID}`, () =>
        HttpResponse.json(
          { detail: { code: "not_found", message: "Recurso no encontrado." } },
          { status: 404 },
        ),
      ),
    );
    renderWithQuery(<ClassificationDetail id={ID} />);
    expect(await screen.findByText("No encontramos esta clasificación.")).toBeInTheDocument();
  });
});
