import type { Metadata } from "next";
import { LoginForm } from "@/app/login/login-form";

export const metadata: Metadata = { title: "Iniciar sesión · Clasificador de PQRS" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { expirada } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <LoginForm sessionExpired={expirada === "1"} />
    </main>
  );
}
