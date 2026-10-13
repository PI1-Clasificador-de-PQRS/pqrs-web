import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clasificador de PQRS",
  description: "Panel del clasificador automático de PQRS",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
