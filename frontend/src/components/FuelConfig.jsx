import React from 'react';

export default function FuelConfig({ config, onChange }) {
  const set = (key, val) => onChange({ ...config, [key]: parseFloat(val) || 0 });

  const spread = (config.customerFuelPct || 0) - (config.ourFuelPct || 0);

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>Fuel Configuration</h3>
      <div style={styles.grid}>
        <label style={styles.label}>
          Our Fuel Discount %
          <div style={styles.hint}>What we pay to carrier (e.g. 12.8)</div>
          <input
            type="number" step="0.1" min="0" max="50"
            value={config.ourFuelPct ?? 12.8}
            onChange={e => set('ourFuelPct', e.target.value)}
            style={styles.input}
          />
        </label>
        <label style={styles.label}>
          Published Fuel %
          <div style={styles.hint}>Carrier published rate (e.g. 17.1)</div>
          <input
            type="number" step="0.1" min="0" max="50"
            value={config.publishedFuelPct ?? 17.1}
            onChange={e => set('publishedFuelPct', e.target.value)}
            style={styles.input}
          />
        </label>
        <label style={styles.label}>
          Customer Fuel %
          <div style={styles.hint}>What we bill customer (usually = published)</div>
          <input
            type="number" step="0.1" min="0" max="50"
            value={config.customerFuelPct ?? 17.1}
            onChange={e => set('customerFuelPct', e.target.value)}
            style={styles.input}
          />
        </label>
        <div style={styles.spreadBox}>
          <div style={styles.spreadLabel}>Fuel Spread</div>
          <div style={styles.spreadValue}>{spread.toFixed(1)}%</div>
          <div style={styles.spreadHint}>per dollar of sell base</div>
        </div>
      </div>
      <div style={styles.formula}>
        Our cost = base × (1 + {(config.ourFuelPct ?? 12.8).toFixed(1)}%) &nbsp;|&nbsp;
        Sell fuel = sell base × {(config.customerFuelPct ?? 17.1).toFixed(1)}% &nbsp;|&nbsp;
        Spread = {spread.toFixed(1)}% on every $1 base
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '16px 0 8px' },
  heading: { fontSize: 16, fontWeight: 700, marginBottom: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 12 },
  label: { display: 'flex', flexDirection: 'column', fontSize: 13, fontWeight: 600, color: '#374151' },
  hint: { fontWeight: 400, color: '#9ca3af', fontSize: 11, marginBottom: 4, marginTop: 2 },
  input: { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 15, width: '100%' },
  spreadBox: {
    background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
    padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  },
  spreadLabel: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  spreadValue: { fontSize: 24, fontWeight: 800, color: '#1d4ed8' },
  spreadHint: { fontSize: 11, color: '#6b7280' },
  formula: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#6b7280' },
};
