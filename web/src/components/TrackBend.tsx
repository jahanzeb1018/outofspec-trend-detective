// A stylised track (two rails + sleepers) that kinks into an S-shape when the safety margin is gone.
export function TrackBend({ bsm }: { bsm: number }) {
  const W = 560;
  const H = 120;
  const amp = bsm < 0 ? Math.min(28, 10 + -bsm * 2) : bsm < 11 ? 3 : 0;
  const pts = (off: number) => {
    const out: string[] = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const xx = 10 + t * (W - 20);
      const bump = amp * Math.sin((t - 0.5) * Math.PI * 2) * Math.exp(-(((t - 0.5) / 0.16) ** 2));
      out.push(`${xx},${H / 2 + off + bump}`);
    }
    return out.join(" ");
  };
  const sleepers = Array.from({ length: 28 }, (_, i) => 18 + i * ((W - 36) / 27));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={bsm < 0 ? "Track drawn buckled: no safety margin" : "Track drawn straight"}>
      {sleepers.map((sx) => {
        const t = (sx - 10) / (W - 20);
        const bump = amp * Math.sin((t - 0.5) * Math.PI * 2) * Math.exp(-(((t - 0.5) / 0.16) ** 2));
        return <rect key={sx} x={sx - 4} y={H / 2 - 22 + bump} width={8} height={44} rx={2} fill="#8d6e63" fillOpacity={0.7} style={{ transition: "y .6s" }} />;
      })}
      <polyline points={pts(-12)} fill="none" stroke={bsm < 0 ? "#d32f2f" : "#9aa6b8"} strokeWidth={5} strokeLinecap="round" style={{ transition: "all .6s" }} />
      <polyline points={pts(12)} fill="none" stroke={bsm < 0 ? "#d32f2f" : "#9aa6b8"} strokeWidth={5} strokeLinecap="round" style={{ transition: "all .6s" }} />
    </svg>
  );
}
