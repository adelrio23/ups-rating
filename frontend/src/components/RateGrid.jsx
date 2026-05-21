import React, { useState } from 'react';

const ZONES = [2, 3, 4, 5, 6, 7, 8];
const SERVICE_LABELS = {
  ground_commercial: 'Ground Commercial',
  ground_residential: 'Ground Residential',
  '2da': '2nd Day Air',
  nda: 'Next Day Air',
};

const fmt = (n) => n == null ? '—' : `$${Number(n).toFixed(2)}`;

export default function RateGrid({ rateSourceMaps, markup, ourFuel, customerFuel, onCellAudit }) {
  const [service, setService] = useState('ground_commercial');
  const [view, setView] = useState('sell'); // sell | cost | carrier | raw

  const rsm = rateSourceMaps?.[service] || {};
  const weights = Object.keys(rsm).map(Number).sort((a, b) => a - b);

  const getCellValue = (cell) => {
    if (!cell) return null;
    const rate = cell.rate;
    if (view === 'raw') return rate;
    if (view === 'cost') return rate * (1 + (ourFuel || 0) / 100);
    if (view === 'sell') return rate * (1 + (markup || 0) / 100);
    if (view === 'carrier') return cell.carrier_name || '';
    return null;
  };

  const getCellColor = (cell) => {
    if (!cell || view === 'carrier') return null;
    const rate = cell.rate;
    if (view === 'sell') return '#dcfce7';
    if (view === 'cost') return '#dbeafe';
    return null;
  };

  const availableServices = Object.keys(rateSourceMaps || {}).filter(
    k => Object.keys(rateSourceMaps[k] || {}).length > 0
  );

  if (!rateSourceMaps || availableServices.length === 0) {
    return <div style={styles.empty}>No rate source maps. Run a scenario to generate grids.</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <div style={styles.tabs}>
          {availableServices.map(svc => (
            <button
              key={svc}
              onClick={() => setService(svc)}
              style={{ ...styles.tab, ...(service === svc ? styles.tabActive : {}) }}
            >
              {SERVICE_LABELS[svc] || svc}
            </button>
          ))}
        </div>
        <div style={styles.views}>
          {[['sell', 'Sell Base'], ['cost', 'Our Cost'], ['raw', 'Raw Rate'], ['carrier', 'Carrier']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{ ...styles.viewBtn, ...(view === v ? styles.viewActive : {}) }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.hint}>
        {view === 'sell' && `Sell base = best rate × (1 + ${markup?.toFixed(1)}% markup). Click any cell to audit.`}
        {view === 'cost' && `Our cost = best rate × (1 + ${ourFuel?.toFixed(1)}% fuel). Click any cell to audit.`}
        {view === 'raw' && 'Best raw carrier rate before any adjustments.'}
        {view === 'carrier' && 'Which carrier wins each weight/zone cell.'}
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Wt</th>
              {ZONES.map(z => <th key={z} style={styles.th}>Zone {z}</th>)}
            </tr>
          </thead>
          <tbody>
            {weights.map(w => (
              <tr key={w}>
                <td style={styles.tdWeight}>{w}</td>
                {ZONES.map(z => {
                  const cell = rsm[String(w)]?.[String(z)];
                  const val = getCellValue(cell);
                  const bg = getCellColor(cell);
                  return (
                    <td
                      key={z}
                      style={{ ...styles.tdCell, ...(bg ? { background: bg } : { color: '#d1d5db' }) }}
                      onClick={() => cell && onCellAudit && onCellAudit({ weight: w, zone: z, service, cell })}
                      title={cell ? `W${w} Z${z}: ${cell.carrier_name} rate $${cell.rate?.toFixed(2)}` : 'No rate'}
                    >
                      {val == null ? '—' : view === 'carrier' ? val : fmt(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  container: {},
  toolbar: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
  tabs: { display: 'flex', gap: 4 },
  tab: { padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: '#f9fafb', cursor: 'pointer', fontSize: 12 },
  tabActive: { background: '#1e3a5f', color: '#fff', border: '1px solid #1e3a5f' },
  views: { display: 'flex', gap: 4 },
  viewBtn: { padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 12, background: '#f9fafb', cursor: 'pointer', fontSize: 11 },
  viewActive: { background: '#2563eb', color: '#fff', border: '1px solid #2563eb' },
  hint: { fontSize: 11, color: '#6b7280', marginBottom: 8 },
  tableWrap: { overflowX: 'auto' },
  table: { borderCollapse: 'collapse', fontSize: 12, minWidth: 600 },
  th: { background: '#1e3a5f', color: '#fff', padding: '5px 10px', textAlign: 'center', whiteSpace: 'nowrap' },
  tdWeight: { padding: '3px 8px', background: '#f9fafb', fontWeight: 600, textAlign: 'center', borderBottom: '1px solid #f3f4f6', fontSize: 11 },
  tdCell: { padding: '3px 8px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', whiteSpace: 'nowrap' },
  empty: { color: '#9ca3af', fontStyle: 'italic', padding: 20 },
};
