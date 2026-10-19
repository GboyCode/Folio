import { useState } from 'react';
import { ArrowUpRight, MapPinned } from 'lucide-react';

type OverviewKind = 'bank' | 'crypto' | 'sim' | 'address';

const items: { kind: OverviewKind; label: string; unit: string }[] = [
  { kind: 'bank', label: '银行卡', unit: '张' },
  { kind: 'crypto', label: 'U 卡', unit: '张' },
  { kind: 'sim', label: 'SIM / eSIM', unit: '张' },
  { kind: 'address', label: '地址信息', unit: '个地区' },
];

function OverviewIllustration({ kind }: { kind: OverviewKind }) {
  if (kind === 'address') return <MapPinned className="overview-illustration overview-map" strokeWidth={0.65} aria-hidden="true" focusable="false"/>;
  return <svg className="overview-illustration" viewBox="0 0 92 72" fill="none" aria-hidden="true" focusable="false">
    {kind === 'bank' && <g transform="rotate(-9 46 36)">
      <rect className="overview-object" x="12" y="15" width="70" height="45" rx="7" />
      <path className="overview-detail" d="M13 27h68" />
      <rect className="overview-chip" x="22" y="34" width="15" height="12" rx="3" />
      <path className="overview-detail" d="M27 34v12m5-12v12m-10-6h15M22 53h19m5 0h9" />
      <circle className="overview-detail" cx="64" cy="45" r="5" />
      <circle className="overview-detail" cx="70" cy="45" r="5" />
    </g>}
    {kind === 'crypto' && <>
      <rect className="overview-object-back" x="23" y="9" width="61" height="40" rx="6" transform="rotate(9 53 29)" />
      <g transform="rotate(-9 42 42)">
        <rect className="overview-object" x="9" y="23" width="66" height="43" rx="7" />
        <circle className="overview-chip" cx="29" cy="42" r="11" />
        <path className="overview-emblem" d="M25 37v7a4 4 0 0 0 8 0v-7" />
        <path className="overview-detail" d="M47 38h17m-17 6h11M19 58h21m5 0h8" />
      </g>
    </>}
    {kind === 'sim' && <g transform="rotate(-8 46 36)">
      <path className="overview-object" d="M19 14h55a7 7 0 0 1 7 7v24L65 61H19a7 7 0 0 1-7-7V21a7 7 0 0 1 7-7Z" />
      <rect className="overview-chip" x="24" y="26" width="28" height="24" rx="5" />
      <path className="overview-detail" d="M33 26v7h10v-7m-10 24v-7h10v7m-19-16h9v9h-9m28-9h-9v9h9M62 26h9m-9 6h6" />
    </g>}
  </svg>;
}

export function WalletOverview({ counts, onSelect }: {
  counts: Record<OverviewKind, number>;
  onSelect: (kind: OverviewKind) => void;
}) {
  const [pressed, setPressed] = useState<OverviewKind | null>(null);
  const release = (kind: OverviewKind) => setPressed(current => current === kind ? null : current);
  return <section className="wallet-overview" aria-label="信息概览">
    <div className="overview-grid">{items.map(({ kind, label, unit }) =>
      <button key={kind} type="button" data-slot="overview-card" className={`overview-card overview-card--${kind}`}
        aria-label={`${label}，${counts[kind]} ${unit}`}
        data-pressed={pressed === kind || undefined}
        onPointerDown={event => { if (event.button === 0) setPressed(kind); }}
        onPointerUp={() => release(kind)} onPointerCancel={() => release(kind)}
        onPointerLeave={() => release(kind)} onBlur={() => release(kind)}
        onClick={() => { setPressed(null); onSelect(kind); }}>
        <span className="overview-label">{label}</span>
        <ArrowUpRight className="overview-arrow" size={15} aria-hidden="true" />
        <span className="overview-total"><strong>{counts[kind]}</strong><span>{unit}</span></span>
        <OverviewIllustration kind={kind} />
      </button>
    )}</div>
  </section>;
}
