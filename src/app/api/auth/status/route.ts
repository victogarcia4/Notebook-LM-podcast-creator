import { NextResponse } from "next/server";
import { authStatus, hasLocalNlm } from "@/lib/notebooklm/client";
import { readWorkerStatus } from "@/lib/worker-status";

export const dynamic = "force-dynamic";

// GET /api/auth/status -> { valid: boolean }
export async function GET() {
  if (!hasLocalNlm()) {
    const worker = await readWorkerStatus();
    return NextResponse.json({ ...worker, source: "worker" });
  }

  const status = await authStatus();
  return NextResponse.json({ ...status, workerOnline: true, source: "local" });
}
