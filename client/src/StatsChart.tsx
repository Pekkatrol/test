import { localDate, type Log } from "./types";

const DAYS = 30;

export default function StatsChart({ logs }: { logs: Log[] }) {
  const byDate = new Map(logs.map((l) => [l.date, l.words]));
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (DAYS - 1 - i));
    const key = localDate(d);
    return { key, label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`, words: Math.max(0, byDate.get(key) ?? 0) };
  });

  const total = days.reduce((n, d) => n + d.words, 0);
  const best = Math.max(...days.map((d) => d.words));
  const today = days[days.length - 1].words;
  const max = Math.max(10, best);

  const W = 600, H = 220, L = 40, B = 24, T = 10;
  const bw = (W - L) / DAYS;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);

  return (
    <div>
      <div className="summary">
        <div><strong>{today}</strong><span>mots aujourd'hui</span></div>
        <div><strong>{total}</strong><span>mots sur {DAYS} jours</span></div>
        <div><strong>{best}</strong><span>meilleur jour</span></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Mots écrits par jour sur ${DAYS} jours`} className="chart">
        {[0, max / 2, max].map((v) => (
          <g key={v}>
            <line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{Math.round(v)}</text>
          </g>
        ))}
        {days.map((d, i) => (
          <g key={d.key}>
            <rect
              x={L + i * bw + 2}
              y={y(d.words)}
              width={bw - 4}
              height={Math.max(d.words ? 2 : 0, H - B - y(d.words))}
              rx="2"
              fill={i === DAYS - 1 ? "var(--accent)" : "var(--bar)"}
            >
              <title>{`${d.label} : ${d.words} mots`}</title>
            </rect>
            {i % 5 === 0 || i === DAYS - 1 ? (
              <text x={L + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">{d.label}</text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}
