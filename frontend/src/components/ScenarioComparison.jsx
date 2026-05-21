import React, { useState, useEffect } from 'react';
import { listScenarios, deleteScenario } from '../api';

const fmt = (n) => n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtPct = (n) => n == null ? '—' : `${Number(n).toFixed(1)}%`;

export default function ScenarioComparison() {
  const [scenarios, setScenarios] = useState([]);
  const [selected, setSelected] = useState([]);

  const load = async () => {
    const { data } = await listScenarios();
    setScenarios(data);
  };

  useEffect(() => { load(); }, []);

  const toggle = (id) => setSelected(s =>
    s.includes(id) ? s.filter(x => x !== id) : [...s, id]
  );

  const handleDelete = async (id) => {
    await deleteScenario(id);
    setSelected(s => s.filter(x => x !== id));
    load();
  };

  const compared = scenarios.filter(s => selected.includes(s.id));

  const metrics = [
    ['Markup %', s => fmtPct(s.markup_pct)],
    ['Our Fuel %', s => fmtPct(s.our_fuel_pct)],
    ['Customer Fuel %', s => fmtPct(s.customer_fuel_pct)],
    ['Volume Multiplier', s => s.volume_multiplier],
    ['', null],
    ['Total Packages', s => (s.results?.total_packages || 0).toLocaleString()],
    ['Green', s => (s.results?.green_count || 0).toLocaleString()],
    ['Grey', s => (s.results?.grey_count || 0).toLocaleString()],
    ['Red', s => (s.results?.red_count || 0).toLocaleString()],
    ['', null],
    ['Customer Monthly', s => fmt(s.results?.customer_total_monthly)],
    ['Our Sell Monthly', s => fmt(s.results?.sell_total_monthly)],
    ['Our Cost Monthly', s => fmt(s.results?.our_cost_total_monthly)],
    ['Customer Savings/Mo', s => fmt(s.results?.customer_savings_monthly)],
    ['Odyssey Margin/Mo', s => fmt(s.results?.margin_monthly)],
    ['Margin %', s => fmtPct(s.results?.margin_pct)],
  ];

  if (scenarios.length === 0) {
    return (
      <div style={styles.container}>
        <h2 style={styles.heading}>Scenario Comparison</h2>
        <p style={styles.empty}>No saved scenarios yet. Run a scenario to save it here.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Scenario Comparison</h2>
      <p style={styles.sub}>Select up to 4 scenarios to compare side by side.</p>

      <div style={styles.scenarioList}>
        {scenarios.map(sc => (
          <div key={sc.id} style={{ ...styles.scCard, ...(selected.includes(sc.id) ? styles.scSelected : {}) }}>
            <label style={styles.scLabel}>
              <input
                type="checkbox"
                checked={selected.includes(sc.id)}
                onChange={() => toggle(sc.id)}
                style={{ marginRight: 6 }}
              />
              <span style={styles.scName}>{sc.name}</span>
            </label>
            <div style={styles.scMeta}>
              Markup: {fmtPct(sc.markup_pct)} · Margin: {fmt(sc.results?.margin_monthly)}/mo
            </div>
            <button onClick={() => handleDelete(sc.id)} style={styles.deleteBtn}>×</button>
          </div>
        ))}
      </div>

      {compared.length >= 2 && (
        <div style={styles.compareWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Metric</th>
                {compared.map(sc => (
                  <th key={sc.id} style={styles.th}>{sc.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map(([label, fn], i) =>
                label === '' ? (
                  <tr key={i}><td colSpan={compared.length + 1} style={styles.spacer} /></tr>
                ) : (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#f9fafb' : '#fff' }}>
                    <td style={styles.tdLabel}>{label}</td>
                    {compared.map(sc => {
                      const val = fn(sc);
                      // Highlight best margin
                      const isMargin = label === 'Odyssey Margin/Mo' || label === 'Margin %';
                      const values = compared.map(s => parseFloat(String(fn(s)).replace(/[$,%]/g, '')) || 0);
                      const best = Math.max(...values);
                      const mine = parseFloat(String(val).replace(/[$,%]/g, '')) || 0;
                      const isBest = isMargin && mine === best && best > 0;
                      return (
                        <td key={sc.id} style={{ ...styles.tdVal, ...(isBest ? styles.best : {}) }}>{val}</td>
                      );
                    })}
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {compared.length === 1 && (
        <div style={styles.hint}>Select at least 2 scenarios to compare.</div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '0 0 24px' },
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  sub: { color: '#666', fontSize: 13, marginBottom: 16 },
  empty: { color: '#9ca3af', fontStyle: 'italic' },
  scenarioList: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  scCard: {
    border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px',
    background: '#fff', position: 'relative', minWidth: 200,
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  scSelected: { border: '2px solid #2563eb', background: '#eff6ff' },
  scLabel: { display: 'flex', alignItems: 'center', cursor: 'pointer' },
  scName: { fontWeight: 600, fontSize: 14 },
  scMeta: { fontSize: 12, color: '#6b7280' },
  deleteBtn: {
    position: 'absolute', top: 8, right: 10, background: 'none', border: 'none',
    fontSize: 16, color: '#9ca3af', cursor: 'pointer',
  },
  compareWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { background: '#1e3a5f', color: '#fff', padding: '8px 12px', textAlign: 'center' },
  tdLabel: { padding: '6px 12px', fontWeight: 600, color: '#374151', background: '#f9fafb' },
  tdVal: { padding: '6px 12px', textAlign: 'center', color: '#374151' },
  spacer: { padding: 4, background: '#e5e7eb' },
  best: { background: '#dcfce7', color: '#16a34a', fontWeight: 700 },
  hint: { color: '#6b7280', fontSize: 13, fontStyle: 'italic', marginTop: 8 },
};
