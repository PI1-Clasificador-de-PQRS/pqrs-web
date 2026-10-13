import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import type { Schemas } from "@/lib/api/client";
import { PROXY, server } from "@/test/msw/server";
import { currentUrl, push, setUrl } from "@/test/navigation";
import { renderWithQuery } from "@/test/render";
import { HistoryView } from "./history-view";

vi.mock("next/navigation", async () => (await import("@/test/navigation")).navigationMock);

function item(n: number, overrides: Partial<Schemas["ClassificationOut"]> = {}) {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    text_anonymized: `Texto ${n}`,
    category: "Reclamo",
    model: "classifier",
    model_version: "clf-1",
    source: "ui",
    external_ref: null,
    batch_id: null,
    created_at: "2026-10-13T01:00:00Z",
    ...overrides,
  } satisfies Schemas["ClassificationOut"];
}

/** Sirve /classifications y guarda los parámetros de cada petición. */
function serveClassifications(
  respond: (
    params: URLSearchParams,
  ) => Schemas["ClassificationPage"] | Response | Promise<Response>,
) {
  const calls: URLSearchParams[] = [];
  server.use(
    http.get(`${PROXY}/classifications`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      calls.push(params);
      const result = respond(params);
      return result instanceof Response || result instanceof Promise
        ? result
        : HttpResponse.json(result);
    }),
  );
  return calls;
}

beforeEach(() => {
  push.mockClear();
  setUrl("/historial");
});

describe("Historial", () => {
  it("pide la página con tz=America/Bogota y muestra la fecha en hora de Bogotá", async () => {
    const calls = serveClassifications(() => ({
      items: [item(1, { text_anonymized: "a".repeat(200) })],
      total: 1,
      page: 1,
      page_size: 20,
    }));
    renderWithQuery(<HistoryView />);

    const table = await screen.findByRole("table");
    expect(screen.getByText("1 resultado")).toBeInTheDocument();
    // 01:00 UTC del 13 = 20:00 del 12 en Bogotá.
    const [dateCell] = within(table).getAllByRole("link");
    expect(dateCell).toHaveTextContent(/12 de oct.* 20:00/);
    expect(within(table).getByText(`${"a".repeat(120)}…`)).toBeInTheDocument();
    expect(calls[0]!.get("tz")).toBe("America/Bogota");
    expect(calls[0]!.get("page")).toBe("1");
    expect(calls[0]!.get("page_size")).toBe("20");
  });

  it("lee los filtros de la URL y los envía a la API", async () => {
    setUrl(
      "/historial?date_from=2026-10-01&date_to=2026-10-12&source=ui_batch&model=llm&page=2&page_size=50",
    );
    const calls = serveClassifications(() => ({
      items: [item(1)],
      total: 51,
      page: 2,
      page_size: 50,
    }));
    renderWithQuery(<HistoryView />);

    await screen.findByRole("table");
    expect(Object.fromEntries(calls[0]!)).toEqual({
      date_from: "2026-10-01",
      date_to: "2026-10-12",
      model: "llm",
      source: "ui_batch",
      page: "2",
      page_size: "50",
      tz: "America/Bogota",
    });
    expect(screen.getByLabelText("Desde")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("Origen")).toHaveValue("ui_batch");
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
  });

  it("al filtrar escribe los filtros en la URL y vuelve a la página 1", async () => {
    setUrl("/historial?page=3");
    serveClassifications(() => ({ items: [item(1)], total: 60, page: 3, page_size: 20 }));
    const user = userEvent.setup();
    renderWithQuery(<HistoryView />);
    await screen.findByRole("table");

    await user.selectOptions(screen.getByLabelText("Categoría"), "Denuncia");
    await user.type(screen.getByLabelText("Desde"), "2026-10-01");
    await user.click(screen.getByRole("button", { name: "Filtrar" }));

    expect(push).toHaveBeenLastCalledWith("/historial?date_from=2026-10-01&category=Denuncia");
  });

  it("no envía fechas invertidas", async () => {
    const calls = serveClassifications(() => ({ items: [], total: 0, page: 1, page_size: 20 }));
    const user = userEvent.setup();
    renderWithQuery(<HistoryView />);
    await screen.findByText("Aún no hay clasificaciones.");

    await user.type(screen.getByLabelText("Desde"), "2026-10-12");
    await user.type(screen.getByLabelText("Hasta"), "2026-10-01");
    await user.click(screen.getByRole("button", { name: "Filtrar" }));

    expect(screen.getByText(/no puede ser posterior/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it("con fechas invertidas en la URL no llama a la API", async () => {
    setUrl("/historial?date_from=2026-10-12&date_to=2026-10-01");
    const calls = serveClassifications(() => ({ items: [], total: 0, page: 1, page_size: 20 }));
    renderWithQuery(<HistoryView />);

    expect(await screen.findAllByText(/no puede ser posterior/)).not.toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it("pagina con la URL y mantiene los datos anteriores mientras carga", async () => {
    serveClassifications(async (params) => {
      const page = Number(params.get("page"));
      if (page === 2) await delay(50);
      return HttpResponse.json({
        items: [item(page)],
        total: 45,
        page,
        page_size: 20,
      });
    });
    const user = userEvent.setup();
    renderWithQuery(<HistoryView />);
    expect(await screen.findByText("Texto 1")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(currentUrl()).toBe("/historial?page=2");
    // Mientras llega la página 2, la tabla sigue mostrando la 1.
    expect(screen.getByText("Texto 1")).toBeInTheDocument();
    expect(await screen.findByText("Texto 2")).toBeInTheDocument();
  });

  it("al cambiar el tamaño de página vuelve a la página 1", async () => {
    setUrl("/historial?page=2");
    serveClassifications(() => ({ items: [item(1)], total: 45, page: 2, page_size: 20 }));
    const user = userEvent.setup();
    renderWithQuery(<HistoryView />);
    await screen.findByRole("table");

    await user.selectOptions(screen.getByLabelText("Por página"), "50");
    expect(push).toHaveBeenLastCalledWith("/historial?page_size=50");
  });

  it("vacío por filtros: ofrece limpiarlos", async () => {
    setUrl("/historial?category=Denuncia&page_size=50");
    serveClassifications(() => ({ items: [], total: 0, page: 1, page_size: 50 }));
    const user = userEvent.setup();
    renderWithQuery(<HistoryView />);

    expect(await screen.findByText("Ningún resultado con estos filtros.")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Limpiar filtros" });
    await user.click(buttons.at(-1)!);
    expect(push).toHaveBeenLastCalledWith("/historial?page_size=50");
  });

  it("vacío sin filtros: enlaza a Clasificar", async () => {
    serveClassifications(() => ({ items: [], total: 0, page: 1, page_size: 20 }));
    renderWithQuery(<HistoryView />);
    expect(await screen.findByText("Aún no hay clasificaciones.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Clasifica un texto/ })).toHaveAttribute(
      "href",
      "/clasificar",
    );
  });

  it("muestra el error del catálogo", async () => {
    serveClassifications(() =>
      HttpResponse.json({ detail: { code: "api_unreachable", message: "x" } }, { status: 502 }),
    );
    renderWithQuery(<HistoryView />);
    expect(
      await screen.findByText(/No se pudo contactar el servicio de clasificación/),
    ).toBeInTheDocument();
  });

  it("el botón Atrás (cambio de URL) vuelve a cargar los filtros anteriores", async () => {
    setUrl("/historial?category=Reclamo");
    serveClassifications(() => ({ items: [item(1)], total: 1, page: 1, page_size: 20 }));
    renderWithQuery(<HistoryView />);
    await screen.findByRole("table");
    expect(screen.getByLabelText("Categoría")).toHaveValue("Reclamo");

    act(() => setUrl("/historial?category=Denuncia"));
    expect(screen.getByLabelText("Categoría")).toHaveValue("Denuncia");
  });
});
