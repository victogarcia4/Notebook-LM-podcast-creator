import { NextResponse } from "next/server";
import { authStatus } from "@/lib/notebooklm/client";

export const dynamic = "force-dynamic";

// GET /api/auth/status -> { valid: boolean }
export async function GET() {
  const status = await authStatus();
  return NextResponse.json(status);
}
