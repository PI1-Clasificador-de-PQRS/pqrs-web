"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/metricas", label: "Métricas" },
  { href: "/historial", label: "Historial" },
  { href: "/clasificar", label: "Clasificar" },
] as const;

export function AppHeader({
  organizationName,
  userName,
}: {
  organizationName: string;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await api.POST("/auth/logout");
    } catch {
      // Aunque la API no responda, se sale del panel; la cookie expira sola.
    }
    queryClient.clear();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{organizationName}</p>
          <p className="truncate text-sm text-muted-foreground">{userName}</p>
        </div>
        <nav aria-label="Principal" className="flex gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                  active && "bg-muted",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Button variant="outline" className="ml-auto" onClick={logout} disabled={loggingOut}>
          {loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
        </Button>
      </div>
    </header>
  );
}
