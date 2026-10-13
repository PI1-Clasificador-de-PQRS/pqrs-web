import type { QueryClient } from "@tanstack/react-query";

export const EXPIRED_LOGIN_URL = "/login?expirada=1";

let redirecting = false;

/** Ante un 401: borra todo lo cacheado (datos de la organización) y vuelve al login. */
export function handleUnauthorized(queryClient: QueryClient, navigate: (url: string) => void) {
  if (redirecting) return;
  redirecting = true;
  queryClient.clear();
  navigate(EXPIRED_LOGIN_URL);
}

/** Solo para pruebas. */
export function resetUnauthorizedState() {
  redirecting = false;
}
