import type { ReactNode } from "react";

/** Accessible table alternative shown under every chart. */
export function DataTable({ head, rows, summary = "Show data table" }: { head: ReactNode[]; rows: ReactNode[][]; summary?: string }) {
  return (
    <details className="table-view">
      <summary>{summary}</summary>
      <div className="table-wrap" style={{ maxHeight: 240 }}>
        <table className="data">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
