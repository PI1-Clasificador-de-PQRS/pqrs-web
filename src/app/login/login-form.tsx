"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, unwrap } from "@/lib/api/client";
import { ApiError, errorMessage, formatSeconds } from "@/lib/api/errors";

export const INVALID_LOGIN_MESSAGE = "Correo o contraseña incorrectos.";

/** Ante cualquier 401 el mensaje es genérico: no revela si el correo existe. */
export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return INVALID_LOGIN_MESSAGE;
    if (error.code === "too_many_attempts") {
      const wait =
        error.retryAfter !== undefined
          ? `Espera ${formatSeconds(error.retryAfter)} e inténtalo de nuevo.`
          : "Espera unos minutos e inténtalo de nuevo.";
      return `Demasiados intentos de inicio de sesión. ${wait}`;
    }
  }
  return errorMessage(error);
}

export function LoginForm({ sessionExpired }: { sessionExpired: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await unwrap(api.POST("/auth/login", { body: { email: email.trim(), password } }));
      queryClient.clear();
      router.replace("/metricas");
      router.refresh();
    } catch (caught) {
      setError(loginErrorMessage(caught));
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">Clasificador de PQRS</h1>
        </CardTitle>
        <CardDescription>Inicia sesión con tu correo institucional.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {sessionExpired && !error && (
            <Alert>
              <AlertDescription>Tu sesión expiró. Inicia sesión de nuevo.</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required
              maxLength={320}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div aria-live="assertive">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <Button type="submit" disabled={pending || !email.trim() || !password}>
            {pending ? "Ingresando…" : "Iniciar sesión"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
