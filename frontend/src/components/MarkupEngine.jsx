import React from 'react';

const fmt = (n) => n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n) => n == null ? '—' : `${Number(n).toFixed(1)}%`;

export default function MarkupEngine({ markup, onMarkupChange, summary, running }) {
  const total = (summary?.green_count || 0) + (summary?.grey_count || 0) + (summary?.red_count || 0);

  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;
  const greenPct = pct(summary?.green_count || 0);
  const greyPct = pct(summary?.grey_count || 0);
  const redPct = pct(summary?.red_count || 0);

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>Markup Engine</h3>

      <div style={styles.sliderRow}>
        <span style={styles.sliderLabel}>Markup: <strong>{markup.toFixed(1)}%</strong></span>
        <input
          type="range" min={0} max={15} step={0.5}
          value={markup}
          onChange={e => onMarkupChange(parseFloat(e.target.value))}
          style={styles.slider}
        />
        <input
          type="number" min={0} max={15} step={0.1}
          value={markup}
          onChange={e => onMarkupChange(parseFloat(e.target.value) || 0)}
          style={styles.numInput}
        />
      </div>

      {running && <div style={styles.running}>Recalculating…</div>}

      {summary && (
        <>
          <div style={styles.statsGrid}>
            <Stat label="Packages" value={total.toLocaleString()} />
            <Stat label="Customer Current/Mo" value={fmt(summary.customer_total_monthly)} />
            <Stat label="Our Sell/Mo" value={fmt(summary.sell_total_monthly)} />
            <Stat label="Our Cost/Mo" value={fmt(summary.our_cost_total_monthly)} />
            <Stat label="Customer Savings/Mo" value={fmt(summary.customer_savings_monthly)} color="#16a34a" />
            <Stat label="Odyssey Margin/Mo" value={fmt(summary.margin_monthly)} color="#1d4ed8" />
            <Stat label="Margin %" value={fmtPct(summary.margin_pct)} color="#1d4ed8" />
            <Stat label="Corrections Excluded" value={summary.corrections_count || 0} color="#d97706" />
          </div>

          <div style={styles.pieRow}>
            <PieBar greenPct={greenPct} greyPct={greyPct} redPct={redPct} />
            <div style={styles.legend}>
              <LegendItem color="#16a34a" bg="#dcfce7" label={`Green — saves customer`} count={summary.green_count} pct={greenPct} />
              <LegendItem color="#6b7280" bg="#f3f4f6" label={`Grey — match price`} count={summary.grey_count} pct={greyPct} />
              <LegendItem color="#dc2626" bg="#fef2f2" label={`Red — can't compete`} count={summary.red_count} pct={redPct} />
              {summary.no_rate_count > 0 && (
                <LegendItem color="#7c3aed" bg="#f5f3ff" label="No rate" count={summary.no_rate_count} pct={0} />
              )}
            </div>
          </div>

          {summary.by_service && Object.keys(summary.by_service).length > 0 && (
            <div style={styles.serviceBreakdown}>
              <div style={styles.svcTitle}>By Service</div>
              {Object.entries(summary.by_service).map(([svc, d]) => (
                <div key={svc} style={styles.svcRow}>
                  <span style={styles.svcName}>{svc}</span>
                  <span style={styles.svcCount}>{d.count.toLocaleString()} pkgs</span>
                  <span style={styles.svcMoney}>margin: {fmt(d.margin)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!summary && !running && (
        <div style={styles.empty}>Run a scenario to see results here.</div>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, ...(color ? { color } : {}) }}>{value}</div>
    </div>
  );
}

function PieBar({ greenPct, greyPct, redPct }) {
  return (
    <div style={styles.pieWrap}>
      <div style={styles.pieBar}>
        {greenPct > 0 && <div style={{ ...styles.segment, width: `${greenPct}%`, background: '#16a34a' }} />}
        {greyPct > 0 && <div style={{ ...styles.segment, width: `${greyPct}%`, background: '#9ca3af' }} />}
        {redPct > 0 && <div style={{ ...styles.segment, width: `${redPct}%`, background: '#dc2626' }} />}
      </div>
    </div>
  );
}

function LegendItem({ color, bg, label, count, pct }) {
  return (
    <div style={{ ...styles.legendItem, background: bg }}>
      <div style={{ ...styles.dot, background: color }} />
      <span style={{ color, fontWeight: 600 }}>{count?.toLocaleString()}</span>
      <span style={styles.legendLabel}>{label}</span>
      <span style={{ color: '#9ca3af', fontSize: 11 }}>{pct}%</span>
    </div>
  );
}

const styles = {
  container: { padding: '8px 0 16px' },
  heading: { fontSize: 16, fontWeight: 700, marginBottom: 12 },
  sliderRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  sliderLabel: { fontSize: 14, minWidth: 100 },
  slider: { flex: 1, accentColor: '#2563eb' },
  numInput: { width: 64, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 },
  running: { color: '#6b7280', fontStyle: 'italic', marginBottom: 8, fontSize: 13 },
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 8, marginBottom: 16,
  },
  stat: {
    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8,
    padding: '10px 12px',
  },
  statLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  statValue: { fontSize: 15, fontWeight: 700, color: '#111827' },
  pieWrap: { flex: '0 0 200px' },
  pieBar: {
    height: 20, borderRadius: 10, overflow: 'hidden',
    display: 'flex', background: '#f3f4f6', width: '100%',
  },
  segment: { height: '100%' },
  pieRow: { display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' },
  legend: { display: 'flex', flexDirection: 'column', gap: 4 },
  legendItem: {
    display: 'flex', alignItems: 'center', gap: 6,
    borderRadius: 6, padding: '4px 10px', fontSize: 13,
  },
  dot: { width: 10, height: 10, borderRadius: '50%' },
  legendLabel: { color: '#374151', marginLeft: 2, marginRight: 4 },
  serviceBreakdown: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 },
  svcTitle: { fontWeight: 700, fontSize: 13, marginBottom: 6 },
  svcRow: { display: 'flex', gap: 12, fontSize: 12, color: '#6b7280', marginBottom: 2 },
  svcName: { fontWeight: 600, color: '#374151', minWidth: 130 },
  svcCount: {},
  svcMoney: {},
  empty: { color: '#9ca3af', fontStyle: 'italic' },
};
