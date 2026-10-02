import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeInjector } from "@/components/ThemeInjector";
import { prisma } from "@/lib/prisma";

// H-003 / C-010 (M-06): la CSP lleva un nonce distinto por petición, por lo que
// TODAS las páginas deben renderizarse dinámicamente (Next solo inyecta el nonce
// en los <script> cuando la página no está prerenderizada). La app es 100 %
// autenticada y por petición: el prerender estático no aporta valor aquí.
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await prisma.empresaConfig.findFirst()
  return {
    title: config?.nombre ? `SISMAR — ${config.nombre}` : "SISMAR",
    description: "Sistema de Gestión de Correspondencia Interna",
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // C-010: next-themes inserta un <script> inline para fijar el tema antes de
  // hidratar; debe llevar el nonce de la petición (lo emite el middleware).
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          <ThemeInjector />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
