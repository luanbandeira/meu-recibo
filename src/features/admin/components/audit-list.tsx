import { auditActionLabel } from "@/features/audit/labels";
import { formatDateTime } from "@/lib/format/date";
import type { AuditEntry } from "../queries";

export function AuditList({ entries, showTarget = true }: { entries: AuditEntry[]; showTarget?: boolean }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-600">Nenhuma ação registrada ainda.</p>;
  }

  return (
    <ol className="divide-y divide-slate-100">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <p className="text-sm text-slate-900">
            <span className="font-medium">{entry.actor?.display_name ?? "Administrador removido"}</span>{" "}
            {auditActionLabel(entry.action).toLowerCase()}
            {showTarget && entry.target && (
              <>
                {" "}
                <span className="font-medium">{entry.target.display_name}</span>
              </>
            )}
          </p>
          <time dateTime={entry.created_at} className="shrink-0 text-xs text-slate-500">
            {formatDateTime(entry.created_at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
