import React from 'react';

const fmt = (n) => n == null ? '—' : `$${Number(n).toFixed(4)}`;
const fmtPct = (n) => n == null ? '—' : `${Number(n).toFixed(2)}%`;

export default function AuditModal({ pkg, onClose }) {
  if (!pkg) return null;
  const a = pkg.audit || {};

  const rows = [
    ['Weight', a.weight || pkg.weight],
    ['Zone', a.zone || pkg.zone || '?'],
    ['Service', a.service || pkg.service],
    ['', ''],
    ['Carrier Rate Used', fmt(a.best_rate)],
    ['Carrier Name', a.carrier_name || pkg.carrier_name || '—'],
    ['Carrier ID', a.carrier_id || pkg.carrier_id || '—'],
    ['', ''],
    ['Our Fuel %', fmtPct(a.our_fuel_pct)],
    ['Our Cost Base (best rate × fuel)', fmt(a.our_cost_base)],
    ['Accessorials (our cost)', fmt(a.acc_our_cost)],
    ['Our Cost Total', fmt(a.our_cost_total), '#1d4ed8'],
    ['', ''],
    ['Markup %', fmtPct(a.markup_pct)],
    ['Sell Base (best rate × (1+markup))', fmt(a.sell_base)],
    ['Customer Fuel %', fmtPct(a.customer_fuel_pct)],
    ['Sell Fuel', fmt(a.sell_fuel)],
    ['Accessorials (sell)', fmt(a.acc_sell)],
    ['Sell Total', fmt(a.sell_total), '#16a34a'],
    ['', ''],
    ['Customer Base', fmt(a.customer_base)],
    ['Customer Fuel', fmt(a.customer_fuel)],
    ['Customer Accessorials', fmt(a.acc_customer)],
    ['Customer Total', fmt(a.customer_total), '#374151'],
    ['', ''],
    ['Margin', fmt(a.margin), pkg.status === 'green' ? '#16a34a' : '#dc2626'],
    ['Margin %', fmtPct(a.margin_pct)],
    ['Status', (a.status || pkg.status || '').toUpperCase()],
  ];

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>Package Audit Trail</h3>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <div style={styles.tracking}>
          {pkg.tracking && <span>Tracking: <strong>{pkg.tracking}</strong></span>}
          {pkg.reference && <span style={{ marginLeft: 12 }}>Ref: <strong>{pkg.reference}</strong></span>}
        </div>
        <table style={styles.table}>
          <tbody>
            {rows.map(([label, val, color], i) =>
              label === '' ? (
                <tr key={i}><td colSpan={2} style={styles.spacer} /></tr>
              ) : (
                <tr key={i}>
                  <td style={styles.tdLabel}>{label}</td>
                  <td style={{ ...styles.tdVal, ...(color ? { color, fontWeight: 700 } : {}) }}>{val}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
        <div style={styles.formula}>
          <strong>Formula:</strong> sell total = best_rate × (1 + markup%) × (1 + cust_fuel%) + accessorials
          <br />
          <strong>Margin:</strong> sell total − our cost total
          <br />
          <strong>Classification:</strong> GREEN if sell &lt; their total | GREY if our cost &lt; their total | RED if our cost ≥ their total
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: 12, padding: 24, width: 460, maxWidth: '95vw',
    maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 17, fontWeight: 700, margin: 0 },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af' },
  tracking: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
  table: { width: '100%', borderCollapse: 'collapse', marginBottom: 14 },
  tdLabel: { fontSize: 13, color: '#6b7280', padding: '3px 0', width: '60%' },
  tdVal: { fontSize: 13, color: '#111827', padding: '3px 0', textAlign: 'right' },
  spacer: { padding: '4px 0', borderTop: '1px solid #f3f4f6' },
  formula: {
    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6,
    padding: '10px 12px', fontSize: 11, color: '#6b7280', lineHeight: 1.6,
  },
};
