import { NextResponse } from "next/server";
import {
  authCheck,
  listNotebooks,
  listAudios,
} from "@/lib/notebooklm/client";

export async function GET() {
  try {
    // Verify NotebookLM authentication
    const authed = await authCheck();
    if (!authed) {
      return NextResponse.json(
        { error: "NotebookLM session expired. Please re-authenticate." },
        { status: 401 }
      );
    }

    // List all notebooks
    const notebooks = await listNotebooks();

    // Enrich with audio list (parallel checks for performance)
    const enriched = await Promise.all(
      notebooks.map(async (nb) => {
        try {
          const audios = await listAudios(nb.id);
          return {
            ...nb,
            hasAudio: audios.length > 0,
            audios: audios,
          };
        } catch {
          return { ...nb, hasAudio: false, audios: [] };
        }
      })
    );

    return NextResponse.json({ notebooks: enriched });
  } catch (error: any) {
    console.error("Error listing notebooks:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list notebooks" },
      { status: 500 }
    );
  }
}
