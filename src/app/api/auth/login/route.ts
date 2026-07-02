import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export const dynamic = "force-dynamic";

// POST /api/auth/login -> lanza el navegador de login de NotebookLM (solo local).
// El script abre Chrome, el usuario inicia sesión y guarda la sesión solo.
export async function POST() {
  const nlm =
    process.env.NLM_PATH ||
    "C:/Users/skint/.notebooklm-venv/Scripts/notebooklm.exe";

  // Deriva el python del venv a partir de la ruta del CLI.
  const python =
    process.env.NLM_PYTHON ||
    path.normalize(nlm).replace(/notebooklm\.exe$/i, "python.exe");

  const script = path.join(process.cwd(), "scripts", "nlm_login.py");

  // El login por navegador solo tiene sentido en la máquina local (Windows con
  // Chrome). En un servidor sin escritorio (p. ej. Vercel) no es posible.
  if (!fs.existsSync(python) || !fs.existsSync(script)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "El login por navegador solo funciona ejecutando la app localmente en tu Windows (donde está NotebookLM instalado).",
      },
      { status: 400 }
    );
  }

  try {
    const child = spawn(python, [script], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.unref();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "No se pudo lanzar el login" },
      { status: 500 }
    );
  }
}
