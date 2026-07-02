"use client";

import { useEffect, useRef, useState } from "react";

export interface JobStatus {
  jobId: string;
  podcastId: string;
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  stage: string;
  progress: number;
  errorMsg?: string | null;
  audioPath?: string | null;
  podcastStatus?: string;
  error?: string;
}

/**
 * Suscribe a /api/status/:jobId vía Server-Sent Events y devuelve el
 * último estado recibido. Pasa jobId = null para no conectar.
 */
export function useSSE(jobId: string | null): JobStatus | null {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) return;
    const es = new EventSource(`/api/status/${jobId}`);
    esRef.current = es;

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as JobStatus;
        setStatus(data);
        if (data.status === "DONE" || data.status === "FAILED" || data.error) {
          es.close();
        }
      } catch {
        /* ignora líneas no-JSON */
      }
    };

    es.onerror = () => {
      // El servidor cierra el stream al terminar; no es necesariamente un fallo.
      es.close();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [jobId]);

  return status;
}
