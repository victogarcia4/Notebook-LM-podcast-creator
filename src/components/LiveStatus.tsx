"use client";

import { useSSE } from "@/hooks/useSSE";
import ProgressTracker from "./ProgressTracker";

export default function LiveStatus({ jobId }: { jobId: string }) {
  const status = useSSE(jobId);
  if (!status) return <div className="card text-slate-400">Conectando…</div>;
  return <ProgressTracker status={status} />;
}
