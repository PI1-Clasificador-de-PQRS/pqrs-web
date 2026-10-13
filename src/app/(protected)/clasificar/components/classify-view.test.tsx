import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ModelInfo } from "@/lib/api/client";
import { model, renderWithQuery } from "@/test/render";
import { PROXY, server } from "@/test/msw/server";
import { ClassifyView } from "./classify-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

function serveModels(...responses: ModelInfo[][]) {
  let call = 0;
  server.use(
    http.get(`${PROXY}/models`, () => {
      const body = responses[Math.min(call, responses.length - 1)];
      call++;
      return HttpResponse.json(body);
    }),
  );
  return () => call;
}

function radio(name: RegExp) {
  return screen.getByRole("radio", { name });
}

describe("selector de motor", () => {
  it("preselecciona el LLM si está disponible", async () => {
    serveModels([model({ id: "llm" }), model({ id: "classifier" })]);
    renderWithQuery(<ClassifyView />);
    await vi.waitFor(() => expect(radio(/LLM/)).toBeChecked());
    expect(radio(/Clasificador/)).not.toBeChecked();
  });

  it("sin LLM disponible preselecciona el clasificador y muestra el LLM deshabilitado", async () => {
    serveModels([
      model({ id: "llm", available: false, reason: "not_configured" }),
      model({ id: "classifier" }),
    ]);
    renderWithQuery(<ClassifyView />);
    await vi.waitFor(() => expect(radio(/Clasificador/)).toBeChecked());
    expect(radio(/LLM/)).toBeDisabled();
    expect(screen.getByText("No configurado")).toBeInTheDocument();
  });

  it.each([
    [{ reason: "not_configured" as const }, "No configurado"],
    [
      { reason: "temporarily_unavailable" as const, retry_after: 42 },
      "No disponible temporalmente, reintente en 42 s",
    ],
    [{ reason: "not_loaded" as const }, "No cargado"],
  ])("muestra el motivo %j como «%s»", async (overrides, text) => {
    serveModels([
      model({ id: "llm", available: false, ...overrides }),
      model({ id: "classifier" }),
    ]);
    renderWithQuery(<ClassifyView />);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(radio(/LLM/)).toBeDisabled();
  });

  it("muestra el F1-macro de evaluación de cada motor", async () => {
    serveModels([
      model({ id: "llm", evaluation: { f1_macro: null } }),
      model({ id: "classifier" }),
    ]);
    renderWithQuery(<ClassifyView />);
    expect(await screen.findByText(/F1-macro de evaluación: sin dato/)).toBeInTheDocument();
    expect(screen.getByText(/F1-macro de evaluación: 0,78/)).toBeInTheDocument();
  });

  it("tras un 503 no cambia de motor: consulta /models y deja decidir al usuario", async () => {
    const modelCalls = serveModels(
      [model({ id: "llm" }), model({ id: "classifier" })],
      [
        model({ id: "llm", available: false, reason: "temporarily_unavailable", retry_after: 30 }),
        model({ id: "classifier" }),
      ],
    );
    const sentModels: unknown[] = [];
    server.use(
      http.post(`${PROXY}/classify`, async ({ request }) => {
        sentModels.push(((await request.json()) as { model: unknown }).model);
        return HttpResponse.json(
          { detail: { code: "llm_unavailable", message: "El motor LLM no está disponible." } },
          { status: 503, headers: { "retry-after": "30" } },
        );
      }),
    );
    const user = userEvent.setup();
    renderWithQuery(<ClassifyView />);
    await vi.waitFor(() => expect(radio(/LLM/)).toBeChecked());

    await user.type(screen.getByLabelText("Texto de la PQRS"), "Necesito una copia de mi factura");
    await user.click(screen.getByRole("button", { name: "Clasificar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("El motor LLM no está disponible en este momento.");
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Elegir otro motor" })).toBeInTheDocument();

    await vi.waitFor(() => expect(modelCalls()).toBe(2));
    expect(await screen.findAllByText(/reintente en 30 s/)).not.toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent(
      "El motor seleccionado no está disponible",
    );
    // Sigue elegido el LLM (ahora deshabilitado); no se cambió al clasificador.
    expect(radio(/LLM/)).toBeChecked();
    expect(radio(/Clasificador/)).not.toBeChecked();
    expect(sentModels).toEqual(["llm"]);
  });
});

describe("pestaña Individual", () => {
  beforeEach(() => serveModels([model({ id: "llm" }), model({ id: "classifier" })]));

  it("envía el motor elegido y muestra la categoría y el motor usado", async () => {
    let body: unknown;
    server.use(
      http.post(`${PROXY}/classify`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          id: "0b9d6c58-4d6f-4f7e-9d8e-3c1d2e0f9a11",
          category: "Solicitud de información",
          model: "classifier",
          model_version: "v1",
          timestamp: "2026-10-12T00:00:00Z",
        });
      }),
    );
    const user = userEvent.setup();
    renderWithQuery(<ClassifyView />);
    await vi.waitFor(() => expect(radio(/LLM/)).toBeChecked());
    await user.click(radio(/Clasificador/));
    await user.type(screen.getByLabelText("Texto de la PQRS"), "  ¿Cuál es el horario?  ");
    await user.click(screen.getByRole("button", { name: "Clasificar" }));

    const result = await screen.findByRole("region", { name: "Resultado" });
    expect(result).toHaveTextContent("Solicitud de información");
    expect(result).toHaveTextContent("Clasificador local");
    expect(within(result).getByRole("link", { name: "Ver en el historial" })).toHaveAttribute(
      "href",
      "/historial",
    );
    expect(body).toEqual({ text: "¿Cuál es el horario?", model: "classifier" });
  });

  it("valida el texto antes de enviar (vacío o de más de 5.000 caracteres)", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ClassifyView />);
    await vi.waitFor(() => expect(radio(/LLM/)).toBeChecked());
    const button = screen.getByRole("button", { name: "Clasificar" });
    const textarea = screen.getByLabelText("Texto de la PQRS");

    await user.type(textarea, "   ");
    expect(button).toBeDisabled();
    expect(screen.getByText(/0 \/ 5\.000 caracteres/)).toBeInTheDocument();

    await user.clear(textarea);
    await user.click(textarea);
    await user.paste("a".repeat(5001));
    expect(button).toBeDisabled();
    expect(screen.getByText(/El texto supera el máximo permitido/)).toBeInTheDocument();
  });

  it.each([
    [422, "invalid_request", {}, /El texto no es válido/],
    [429, "rate_limited", { "retry-after": "12" }, /límite de solicitudes.*Espera 12 segundos/],
    [413, "payload_too_large", {}, /demasiado grande/],
  ])("ante un %i muestra un mensaje claro", async (status, code, headers, message) => {
    server.use(
      http.post(`${PROXY}/classify`, () =>
        HttpResponse.json({ detail: { code, message: "x" } }, { status, headers }),
      ),
    );
    const user = userEvent.setup();
    renderWithQuery(<ClassifyView />);
    await vi.waitFor(() => expect(radio(/LLM/)).toBeChecked());
    await user.type(screen.getByLabelText("Texto de la PQRS"), "Texto de prueba");
    await user.click(screen.getByRole("button", { name: "Clasificar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });
});
