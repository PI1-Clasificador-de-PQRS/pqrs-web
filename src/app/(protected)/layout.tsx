import { redirect } from "next/navigation";
import { AppHeader } from "@/app/(protected)/app-header";
import { fetchMe } from "@/lib/server/api";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const result = await fetchMe();
  if (result.kind === "unauthorized") redirect("/login");
  if (result.kind === "error") {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">No se pudo cargar el panel</h1>
        <p className="mt-2 text-muted-foreground">
          El servicio de clasificación no responde en este momento. Recarga la página en unos
          minutos; si el problema continúa, avisa al administrador.
        </p>
      </main>
    );
  }
  return (
    <>
      <AppHeader organizationName={result.me.organization.name} userName={result.me.user.name} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
