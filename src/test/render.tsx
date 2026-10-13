import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ModelInfo } from "@/lib/api/client";

export function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
}

export function model(overrides: Partial<ModelInfo> & Pick<ModelInfo, "id">): ModelInfo {
  return {
    label: overrides.id === "llm" ? "LLM (zero-shot)" : "Clasificador local",
    available: true,
    reason: null,
    retry_after: null,
    evaluation: { f1_macro: overrides.id === "llm" ? 0.83 : 0.78 },
    ...overrides,
  };
}
