/** File Path: components/shared/ErrorDisplay.tsx */

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function deviceHint(): string {
  if (typeof navigator === "undefined") return "unknown";
  const touch = navigator.maxTouchPoints > 0;
  const narrow = typeof window !== "undefined" && window.innerWidth < 768;
  return touch && narrow ? "Mobile" : touch ? "Tablet" : "Desktop";
}

export function ErrorDisplay({
  error,
  reset,
  componentName,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  componentName: string;
}) {
  const pathname = usePathname();
  const [reveal, setReveal] = useState(false);
  const [reportState, setReportState] = useState<"idle" | "sending" | "sent">("idle");
  const [reportText, setReportText] = useState("");
  const [showReportForm, setShowReportForm] = useState(false);

  useEffect(() => {
    fetch("/api/errors/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        component: componentName,
        route: pathname,
        device: deviceHint(),
      }),
    }).catch(() => {});

    fetch("/api/errors/reveal-status")
      .then((res) => res.json())
      .then((data) => setReveal(Boolean(data.reveal)))
      .catch(() => {});
    // Intentionally runs once per mount (a genuinely new error) — error
    // and componentName are stable for the lifetime of this boundary
    // instance, and re-running on pathname alone isn't the goal here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitReport() {
    setReportState("sending");
    try {
      await fetch("/api/error-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: error.message.slice(0, 300), description: reportText || undefined, route: pathname }),
      });
      setReportState("sent");
    } catch {
      setReportState("idle");
    }
  }

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted">
        This has been logged automatically. You can try again, or tell us what you were doing when it happened.
      </p>

      <div className="flex gap-2">
        {reset && (
          <button onClick={reset} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Try again
          </button>
        )}
        {!showReportForm && reportState !== "sent" && (
          <button onClick={() => setShowReportForm(true)} className="rounded-md border border-muted/30 px-4 py-2 text-sm">
            Report this issue
          </button>
        )}
      </div>

      {showReportForm && reportState !== "sent" && (
        <div className="flex w-full flex-col gap-2 text-left">
          <textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder="What were you trying to do? (optional)"
            rows={3}
            className="rounded-md border border-muted/30 px-3 py-2 text-sm"
          />
          <button
            onClick={submitReport}
            disabled={reportState === "sending"}
            className="self-start rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {reportState === "sending" ? "Sending…" : "Send report"}
          </button>
        </div>
      )}
      {reportState === "sent" && <p className="text-sm text-accent">Thanks — this has reached our team.</p>}

      {reveal && (
        <div className="mt-2 w-full rounded-md border border-red-200 bg-red-50 p-3 text-left">
          <p className="text-xs font-medium text-red-800">Detail (visible to admins only)</p>
          <p className="mt-1 font-mono text-xs text-red-700">{error.message}</p>
          {error.stack && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-red-600">{error.stack}</pre>
          )}
        </div>
      )}
    </div>
  );
}