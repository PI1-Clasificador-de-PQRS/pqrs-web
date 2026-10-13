"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { setUnauthorizedHandler } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { handleUnauthorized } from "@/lib/api/session";

function shouldRetry(failureCount: number, error: unknown) {
  // Solo se reintentan fallos transitorios; un 4xx no cambia por repetir.
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: shouldRetry, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
  );

  useEffect(() => {
    setUnauthorizedHandler(() =>
      handleUnauthorized(queryClient, (url) => window.location.assign(url)),
    );
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
