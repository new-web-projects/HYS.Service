"use client";

import { useEffect, useState } from "react";

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  actor: { name: string; role: string } | null;
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/audit-logs")
      .then((res) => res.json())
      .then((data) => setLogs(data.logs))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Audit logs</h1>
      <p className="mt-1 text-sm text-muted">Every admin action taken through this panel, in one place.</p>

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {logs.map((l) => (
            <li key={l.id} className="rounded-lg border border-border p-3 text-sm">
              <p>
                <span className="font-medium">{l.actor?.name ?? "System"}</span> · {l.action} · {l.entity}
                {l.entityId ? ` (${l.entityId.slice(0, 8)}…)` : ""}
              </p>
              <p className="text-xs text-muted">{new Date(l.createdAt).toLocaleString()}</p>
            </li>
          ))}
          {logs.length === 0 && <p className="text-sm text-muted">Nothing logged yet.</p>}
        </ul>
      )}
    </div>
  );
}