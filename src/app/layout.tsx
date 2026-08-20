import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { auth } from "@/lib/auth";
import { SessionProvider } from "@/components/shell/SessionProvider";

/* Self-hosted so the panel never flashes a fallback and never phones home.
   Archivo ships the wdth axis — that expanded heading width is the signature. */
const archivo = localFont({
  src: "../fonts/archivo-var.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
});

const mono = localFont({
  src: "../fonts/jetbrains-mono-var.woff2",
  variable: "--font-mono",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Control Room",
  description:
    "A week you can actually see. Hours banked, blocks scheduled, streak intact.",
};

export const viewport: Viewport = {
  themeColor: "#100f0d",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Fetched once here (server-side) so client components read it from context
  // instead of each firing its own request to /api/auth/session on mount.
  const session = await auth();

  return (
    <html lang="en" className={`${archivo.variable} ${mono.variable}`}>
      <body className="antialiased">
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
