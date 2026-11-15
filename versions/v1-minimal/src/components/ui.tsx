import { Component, type ReactNode } from "react";
import { GLOSSARY } from "../content/glossary";
import type { ColorScale } from "../colors";
import { fmt } from "../config";
import { STATUS_LABEL, type Status } from "../model/watch";

export function Seg<T extends string | number>({ options, value, onChange, label }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.id)} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" className="switch" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      {label}
      <span className="track">
        <span className="knob" />
      </span>
    </button>
  );
}

export function Metric({ value, label, color }: { value: ReactNode; label: ReactNode; color?: string }) {
  return (
    <div className="metric">
      <div className="v" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="l">{label}</div>
    </div>
  );
}

export function StatusChip({ s }: { s: Status }) {
  return (
    <span className={`chip st-${s}`}>
      <span className="dot" />
      {STATUS_LABEL[s]}
    </span>
  );
}

export function Kpi({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "bad" | "good" | "warn" }) {
  const color = tone === "bad" ? "var(--bad)" : tone === "good" ? "var(--ok)" : tone === "warn" ? "var(--tight)" : undefined;
  return (
    <div className="metric">
      <div className="l" style={{ marginTop: 0 }}>{label}</div>
      <div className="v" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="l">{sub}</div>}
    </div>
  );
}

export function Term({ k, children }: { k: keyof typeof GLOSSARY | string; children?: ReactNode }) {
  const g = GLOSSARY[k];
  if (!g) return <>{children}</>;
  return (
    <span className="term" tabIndex={0}>
      {children ?? g.term}
      <span className="tip" role="tooltip">
        <b>{g.term}.</b> {g.def}
      </span>
    </span>
  );
}

export function Prov({ kind }: { kind: "nasa" | "user" | "osm" | "ai" | "rules" }) {
  const label = { nasa: "NASA data", user: "Your input", osm: "OpenStreetMap", ai: "SI-assisted", rules: "Rule-based" }[kind];
  return <span className={`chip ${kind === "rules" ? "" : kind}`}>{label}</span>;
}

export function Sig({ raw, fdr, rare }: { raw: boolean; fdr?: boolean | null; rare?: boolean }) {
  if (rare) return <span className="chip">Too rare for a trend</span>;
  if (fdr === undefined || fdr === null) return raw ? <span className="chip st-ok">Significant (p &lt; 0.05)</span> : <span className="chip">Not significant yet</span>;
  if (fdr) return <span className="chip st-ok">Significant after FDR</span>;
  if (raw) return <span className="chip st-heat-watch">Single test only</span>;
  return <span className="chip">Not significant yet</span>;
}

export function Legend({ scale, title, unit }: { scale: ColorScale; title: string; unit: string }) {
  const [a, b] = scale.domain;
  return (
    <div className="small ink2" aria-label={`Legend: ${title}`}>
      <div>{title}</div>
      <div style={{ height: 8, borderRadius: 4, margin: "6px 0 2px", background: `linear-gradient(90deg, ${scale.colors.join(",")})` }} />
      <div className="row tabular" style={{ justifyContent: "space-between" }}>
        <span>{fmt(a, 0)}</span>
        <span>
          {fmt(b, 0)} {unit}
        </span>
      </div>
    </div>
  );
}

export function Loading({ what = "data" }: { what?: string }) {
  return <div className="loading">Loading {what}…</div>;
}

export function ErrorNote({ error }: { error: string }) {
  return <div className="warnbox">Could not load data: {error}</div>;
}

export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: String(e) };
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error)
      return (
        <div className="wrap section">
          <div className="warnbox">
            Something went wrong on this page: {this.state.error}. <a href="#/">Back to the start</a>
          </div>
        </div>
      );
    return this.props.children;
  }
}
