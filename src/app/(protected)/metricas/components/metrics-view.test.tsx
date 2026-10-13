import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { Schemas } from "@/lib/api/client";
import { PROXY, server } from "@/test/msw/server";
import { push, setUrl } from "@/test/navigation";
import { renderWithQuery } from "@/test/render";
import { MetricsView } from "./metrics-view";

vi.mock("next/navigation", async () => (await import("@/test/navigation")).navigationMock);

function summary(overrides: Partial<Schemas["MetricsSummary"]> = {}): Schemas["MetricsSummary"] {
  return {
    total: 10,
    by_category: { Petición: 4, Reclamo: 3, Denuncia: 1, "Solicitud de información": 2 },
    by_model: { llm: 4, classifier: 6 },
    by_source: { ui: 2, ui_batch: 7, api: 1 },
    timeseries: [
      { period: "2026-10-11", count: 3 },
      { period: "2026-10-12", count: 7 },
    ],
    evaluation: { llm: { f1_macro: 0.83 }, classifier: { f1_macro: null } },
    timezone: "America/Bogota",
    ...overrides,
  };
}

function serveSummary(body: Schemas["MetricsSummary"]) {
  const calls: URLSearchParams[] = [];
  server.use(
    http.get(`${PROXY}/metrics/summary`, ({ request }) => {
      calls.push(new URL(request.url).searchParams);
      return HttpResponse.json(body);
    }),
  );
  return calls;
}

function figure(name: string) {
  return screen.getByRole("figure", { name });
}

beforeEach(() => {
  push.mockClear();
  setUrl("/metricas");
  vi.useFakeTimers({ toFake: ["Date"] });
  // 23:30 del 12 de octubre en Bogotá (ya el 13 en UTC).
  vi.setSystemTime(new Date("2026-10-13T04:30:00Z"));
});

afterEach(() => vi.useRealTimers());

describe("Métricas", () => {
  it("por defecto pide los últimos 30 días de Bogotá, por día y con tz", async () => {
    const calls = serveSummary(summary());
    renderWithQuery(<MetricsView />);

    expect(await screen.findByTestId("metrics-total")).toHaveTextContent("10");
    expect(Object.fromEntries(calls[0]!)).toEqual({
      date_from: "2026-09-13",
      date_to: "2026-10-12",
      granularity: "day",
      tz: "America/Bogota",
    });
    expect(screen.getByRole("link", { name: "Ver en el historial" })).toHaveAttribute(
      "href",
      "/historial?date_from=2026-09-13&date_to=2026-10-12",
    );
  });

  it("muestra la categoría más frecuente, el porcentaje por motor y la evaluación", async () => {
    serveSummary(summary());
    renderWithQuery(<MetricsView />);

    expect(await screen.findByTestId("metrics-top-category")).toHaveTextContent("Petición");
    expect(screen.getByText(/^40,0\s?%$/)).toBeInTheDocument();
    expect(screen.getByText(/^60,0\s?%$/)).toBeInTheDocument();
    expect(screen.getByText("0,83")).toBeInTheDocument();
    expect(screen.getByText("No disponible")).toBeInTheDocument();
    expect(screen.getByText(/66 solicitudes reales etiquetadas a mano/)).toBeInTheDocument();
    expect(screen.getByText(/Confusión más frecuente/)).toBeInTheDocument();
  });

  it("«Ver como tabla» muestra los mismos datos que el gráfico", async () => {
    serveSummary(summary());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithQuery(<MetricsView />);
    await screen.findByTestId("metrics-total");

    const categories = figure("Clasificaciones por categoría");
    // Resumen para lectores de pantalla con los mismos valores.
    expect(categories).toHaveAccessibleDescription(
      "Petición: 4; Reclamo: 3; Denuncia: 1; Solicitud de información: 2.",
    );
    await user.click(within(categories).getByRole("button", { name: "Ver como tabla" }));
    const rows = within(categories)
      .getAllByRole("row")
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      );
    expect(rows).toEqual([
      ["Petición", "4"],
      ["Reclamo", "3"],
      ["Denuncia", "1"],
      ["Solicitud de información", "2"],
    ]);

    const series = figure("Clasificaciones por día");
    await user.click(within(series).getByRole("button", { name: "Ver como tabla" }));
    expect(within(series).getAllByRole("row")).toHaveLength(3);
    expect(within(series).getByRole("row", { name: /12 de oct.* 7/ })).toBeInTheDocument();

    const sources = figure("Clasificaciones por origen");
    await user.click(within(sources).getByRole("button", { name: "Ver como tabla" }));
    expect(within(sources).getByRole("row", { name: "Lote 7" })).toBeInTheDocument();
  });

  it("con total 0: «—» y el estado vacío con enlace a Clasificar", async () => {
    serveSummary(
      summary({
        total: 0,
        by_category: { Petición: 0, Reclamo: 0, Denuncia: 0, "Solicitud de información": 0 },
        by_model: { llm: 0, classifier: 0 },
        by_source: { ui: 0, ui_batch: 0, api: 0 },
        timeseries: [],
      }),
    );
    renderWithQuery(<MetricsView />);

    expect(await screen.findByText("No hay clasificaciones en este período.")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-top-category")).toHaveTextContent("—");
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /Clasifica un texto/ })).toHaveAttribute(
      "href",
      "/clasificar",
    );
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  });

  it("un rango de más de 400 días por día se pide por semana y se avisa", async () => {
    setUrl("/metricas?period=custom&date_from=2024-01-01&date_to=2026-10-12");
    const calls = serveSummary(summary());
    renderWithQuery(<MetricsView />);

    expect(await screen.findByText(/El rango supera 400 días/)).toBeInTheDocument();
    expect(calls[0]!.get("granularity")).toBe("week");
    expect(
      await screen.findByRole("figure", { name: "Clasificaciones por semana" }),
    ).toBeInTheDocument();
  });

  it("todo el historial: sin fechas y por semana", async () => {
    setUrl("/metricas?period=all");
    const calls = serveSummary(summary());
    renderWithQuery(<MetricsView />);

    await screen.findByTestId("metrics-total");
    expect(Object.fromEntries(calls[0]!)).toEqual({ granularity: "week", tz: "America/Bogota" });
    expect(screen.getByLabelText("Agrupar por")).toBeDisabled();
    expect(screen.getByRole("link", { name: "Ver en el historial" })).toHaveAttribute(
      "href",
      "/historial",
    );
  });

  it("el período y la granularidad se escriben en la URL", async () => {
    serveSummary(summary());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithQuery(<MetricsView />);
    await screen.findByTestId("metrics-total");

    await user.selectOptions(screen.getByLabelText("Período"), "month");
    expect(push).toHaveBeenLastCalledWith("/metricas?period=month");

    await user.selectOptions(screen.getByLabelText("Agrupar por"), "week");
    expect(push).toHaveBeenLastCalledWith("/metricas?period=month&granularity=week");
  });

  it("el rango personalizado valida las fechas antes de enviar", async () => {
    const calls = serveSummary(summary());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithQuery(<MetricsView />);
    await screen.findByTestId("metrics-total");

    await user.selectOptions(screen.getByLabelText("Período"), "custom");
    await user.type(screen.getByLabelText("Desde"), "2026-10-12");
    await user.type(screen.getByLabelText("Hasta"), "2026-10-01");
    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/no puede ser posterior/);
    expect(push).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it("muestra el error de la API", async () => {
    server.use(
      http.get(`${PROXY}/metrics/summary`, () =>
        HttpResponse.json(
          { detail: { code: "invalid_request", message: "Más de 400 períodos." } },
          { status: 422 },
        ),
      ),
    );
    renderWithQuery(<MetricsView />);
    expect(await screen.findByText(/El texto no es válido|Más de 400/)).toBeInTheDocument();
  });
});
