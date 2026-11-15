/** Orbitrack mark: an "O" that is half orbit (NASA satellite data from space, top) and half railway track
 *  (the network it watches, bottom), around the sun (heat, the threat it measures). Same drawing as public/favicon.svg. */
export function LogoMark() {
  return (
    <g>
      <circle cx={16} cy={16} r={3.6} fill="#f2783a" />
      <path d="M5 16A11 11 0 0 1 27 16" fill="none" stroke="#d63a2f" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M25.4 16A9.4 9.4 0 0 1 6.6 16" fill="none" stroke="#0c0d0f" strokeWidth={1.8} />
      <path d="M28.6 16A12.6 12.6 0 0 1 3.4 16" fill="none" stroke="#0c0d0f" strokeWidth={1.8} />
      <path d="M22.59 21.53L26.26 24.61M16 24.6L16 29.4M9.41 21.53L5.74 24.61" stroke="#0c0d0f" strokeWidth={1.55} strokeLinecap="round" />
      <circle cx={23.36} cy={7.83} r={2.9} fill="#d63a2f" stroke="#fff" strokeWidth={1.5} />
    </g>
  );
}

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <LogoMark />
    </svg>
  );
}
