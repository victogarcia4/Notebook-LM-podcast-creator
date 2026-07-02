import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Podcast Creator — NotebookLM",
  description: "Genera podcasts con IA a partir de un tema o pregunta.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <header className="border-b border-slate-800">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold">
              <span className="text-2xl">🎙️</span>
              <span>Podcast Creator</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/" className="btn-ghost">
                Crear
              </Link>
              <Link href="/library" className="btn-ghost">
                Biblioteca
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-sm text-slate-500">
          Generado con NotebookLM · MVP local
        </footer>
      </body>
    </html>
  );
}
