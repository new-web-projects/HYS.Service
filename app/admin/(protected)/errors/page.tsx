"use client";

import { useCallback, useEffect, useState } from "react";

type ErrorLog = { id: string; message: string; route: string | null; createdAt: string };
type ErrorReport = { id: string; message: string; description: string | null; route: string | null; status: string; createdAt: string };

export default function AdminErrorsPage() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [logsRes, reportsRes] = await Promise.all([fetch("/api/admin/error-logs"), fetch("/api/admin/error-reports")]);
    if (logsRes.ok) setLogs((await logsRes.json()).logs);
    if (reportsRes.ok) setReports((await reportsRes.json()).reports);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/admin/error-reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Errors</h1>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-medium text-muted">User-submitted reports ({reports.length})</h2>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-muted">None yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reports.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">{r.message}</p>
                {r.description && <p className="text-muted">{r.description}</p>}
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted">{r.route ?? "—"}</p>
                  <select
                    value={r.status}
                    onChange={(e) => updateStatus(r.id, e.target.value)}
                    className="rounded-md border border-muted/30 px-2 py-1 text-xs"
                  >
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="resolved">Resolved</option>
                    <option value="wont_fix">Won&apos;t fix</option>
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-muted">System error logs ({logs.length})</h2>
        <p className="mb-3 text-xs text-muted">
          Empty until Part 12 (Error Reveal + Logging + Monitoring) builds the capture mechanism — this view is ready for it.
        </p>
        {logs.length === 0 ? (
          <p className="text-sm text-muted">None yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {logs.map((l) => (
              <li key={l.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">{l.message}</p>
                <p className="text-xs text-muted">
                  {l.route ?? "—"} · {new Date(l.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}