import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { LoginForm } from "@/app/login/login-form";
import { PROXY, server } from "@/test/msw/server";

const router = { replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function renderForm(sessionExpired = false) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LoginForm sessionExpired={sessionExpired} />
    </QueryClientProvider>,
  );
}

async function submit(email = "ana@entidad.gov.co", password = "secreta") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Correo"), email);
  await user.type(screen.getByLabelText("Contraseña"), password);
  await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
}

describe("LoginForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ante un 401 muestra un mensaje genérico", async () => {
    server.use(
      http.post(`${PROXY}/auth/login`, () =>
        HttpResponse.json(
          { detail: { code: "invalid_credentials", message: "Credenciales inválidas." } },
          { status: 401 },
        ),
      ),
    );
    renderForm();
    await submit();
    expect(await screen.findByText("Correo o contraseña incorrectos.")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("ante un 429 muestra el tiempo de espera de Retry-After", async () => {
    server.use(
      http.post(`${PROXY}/auth/login`, () =>
        HttpResponse.json(
          { detail: { code: "too_many_attempts", message: "Demasiados intentos." } },
          { status: 429, headers: { "retry-after": "90" } },
        ),
      ),
    );
    renderForm();
    await submit();
    expect(await screen.findByText(/Demasiados intentos.*Espera 90 segundos/)).toBeInTheDocument();
  });

  it("con éxito redirige a /metricas", async () => {
    let body: unknown;
    server.use(
      http.post(`${PROXY}/auth/login`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ user: {}, organization: {} });
      }),
    );
    renderForm();
    await submit("  ana@entidad.gov.co ");
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/metricas"));
    expect(body).toEqual({ email: "ana@entidad.gov.co", password: "secreta" });
  });

  it("avisa que la sesión expiró", () => {
    renderForm(true);
    expect(screen.getByText("Tu sesión expiró. Inicia sesión de nuevo.")).toBeInTheDocument();
  });
});
