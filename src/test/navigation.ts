import { useEffect, useReducer } from "react";
import { vi } from "vitest";

/**
 * Doble de `next/navigation` con una URL en memoria. Uso:
 * `vi.mock("next/navigation", async () => (await import("@/test/navigation")).navigationMock)`
 * y `setUrl("/historial?page=2")`.
 */
let url = new URL("http://localhost:3000/");
const listeners = new Set<() => void>();

export function setUrl(path: string) {
  url = new URL(path, "http://localhost:3000");
  listeners.forEach((listener) => listener());
}

export function currentUrl(): string {
  return `${url.pathname}${url.search}`;
}

export const push = vi.fn((path: string) => setUrl(path));
export const replace = vi.fn((path: string) => setUrl(path));

/** Re-renderiza al cambiar la URL, como el router real. */
function useUrlSubscription() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => void listeners.delete(force);
  }, []);
}

export const navigationMock = {
  useRouter: () => ({ push, replace, refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => url.pathname,
  useSearchParams: () => {
    useUrlSubscription();
    return new URLSearchParams(url.search);
  },
};
