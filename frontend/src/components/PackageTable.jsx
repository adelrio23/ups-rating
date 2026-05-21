import React, { useState, useMemo } from 'react';

const fmt = (n) => n == null ? '—' : `$${Number(n).toFixed(2)}`;
const STATUS_STYLE = {
  green: { background: '#dcfce7', color: '#15803d' },
  grey: { background: '#f3f4f6', color: '#374151' },
  red: { background: '#fef2f2', color: '#dc2626' },
  correction: { background: '#fefce8', color: '#854d0e' },
  no_rate: { background: '#f5f3ff', color: '#6d28d9' },
};

const PAGE_SIZE = 100;

export default function PackageTable({ packages, onAuditClick }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = packages || [];
    if (filter !== 'all') list = list.filter(p => p.status === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.tracking || '').toLowerCase().includes(q) ||
        (p.reference || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [packages, filter, search]);

  const page_count = Math.ceil(filtered.length / PAGE_SIZE);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totals = useMemo(() => {
    const active = filtered.filter(p => !p.correction_flag);
    const sum = (field) => active.reduce((s, p) => s + (p[field] || 0), 0);
    return {
      customer: sum('customer_total'),
      sell: sum('sell_total'),
      cost: sum('our_cost_total'),
      savings: active.filter(p => p.status === 'green').reduce((s, p) => s + (p.customer_savings || 0), 0),
      margin: sum('margin'),
    };
  }, [filtered]);

  if (!packages || packages.length === 0) {
    return <div style={styles.empty}>No package data. Run a scenario first.</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <div style={styles.filters}>
          {['all', 'green', 'grey', 'red', 'correction', 'no_rate'].map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(0); }}
              style={{ ...styles.filterBtn, ...(filter === f ? styles.filterActive : {}) }}
            >
              {f === 'all' ? `All (${(packages||[]).length})` : f}
            </button>
          ))}
        </div>
        <input
          placeholder="Search tracking / reference…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          style={styles.search}
        />
      </div>

      <div style={styles.summary}>
        Showing {filtered.length.toLocaleString()} packages &nbsp;|&nbsp;
        Their total: <strong>{fmt(totals.customer)}</strong> &nbsp;|&nbsp;
        Sell total: <strong>{fmt(totals.sell)}</strong> &nbsp;|&nbsp;
        Our cost: <strong>{fmt(totals.cost)}</strong> &nbsp;|&nbsp;
        Savings: <strong style={{ color: '#16a34a' }}>{fmt(totals.savings)}</strong> &nbsp;|&nbsp;
        Margin: <strong style={{ color: '#1d4ed8' }}>{fmt(totals.margin)}</strong>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {['Tracking', 'Wt', 'Zn', 'Svc', 'C', 'Their Base', 'Their Fuel', 'Their Acc', 'Their Total',
                'Sell Base', 'Sell Total', 'Our Cost', 'Savings', 'Margin', 'Status'].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((pkg, i) => {
              const status = pkg.status || 'no_rate';
              const st = STATUS_STYLE[status] || {};
              const acc = (pkg.das_charge || 0) + (pkg.das_extended || 0) +
                (pkg.residential_charge || 0) + (pkg.address_correction || 0) +
                (pkg.additional_handling || 0);
              const savings = status === 'green' ? (pkg.customer_savings || 0) : 0;
              return (
                <tr key={i} style={{ background: st.background, color: st.color }}>
                  <td style={{ ...styles.td, ...styles.trackCell }}
                    onClick={() => onAuditClick && onAuditClick(pkg)}
                    title="Click to audit this package"
                  >
                    <span style={styles.trackLink}>{pkg.tracking || `#${i + 1}`}</span>
                  </td>
                  <td style={styles.tdNum}>{pkg.weight}</td>
                  <td style={styles.tdNum}>{pkg.zone || '?'}</td>
                  <td style={styles.tdSvc}>{pkg.service?.replace('_', ' ')}</td>
                  <td style={styles.tdNum}>{pkg.correction_flag ? '⚠' : ''}</td>
                  <td style={styles.tdMoney}>{fmt(pkg.base_charge)}</td>
                  <td style={styles.tdMoney}>{fmt(pkg.fuel_surcharge)}</td>
                  <td style={styles.tdMoney}>{fmt(acc)}</td>
                  <td style={{ ...styles.tdMoney, fontWeight: 600 }}>{fmt(pkg.customer_total)}</td>
                  <td style={styles.tdMoney}>{fmt(pkg.sell_base)}</td>
                  <td style={{ ...styles.tdMoney, fontWeight: 600 }}>{fmt(pkg.sell_total)}</td>
                  <td style={styles.tdMoney}>{fmt(pkg.our_cost_total)}</td>
                  <td style={{ ...styles.tdMoney, color: '#16a34a', fontWeight: 600 }}>{savings > 0 ? fmt(savings) : '—'}</td>
                  <td style={{ ...styles.tdMoney, color: '#1d4ed8' }}>{fmt(pkg.margin)}</td>
                  <td style={{ ...styles.td, textAlign: 'center', fontWeight: 700, fontSize: 11 }}>{status.toUpperCase()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {page_count > 1 && (
        <div style={styles.pagination}>
          <button onClick={() => setPage(0)} disabled={page === 0} style={styles.pageBtn}>«</button>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={styles.pageBtn}>‹</button>
          <span style={styles.pageInfo}>{page + 1} / {page_count}</span>
          <button onClick={() => setPage(p => Math.min(page_count - 1, p + 1))} disabled={page === page_count - 1} style={styles.pageBtn}>›</button>
          <button onClick={() => setPage(page_count - 1)} disabled={page === page_count - 1} style={styles.pageBtn}>»</button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { overflowX: 'auto' },
  toolbar: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
  filters: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  filterBtn: {
    padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 12,
    background: '#f9fafb', cursor: 'pointer', fontSize: 12,
  },
  filterActive: { background: '#2563eb', color: '#fff', border: '1px solid #2563eb' },
  search: { padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, flex: 1, minWidth: 180 },
  summary: { fontSize: 12, color: '#6b7280', marginBottom: 8, background: '#f9fafb', padding: '6px 10px', borderRadius: 6 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { background: '#1e3a5f', color: '#fff', padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 600 },
  td: { padding: '4px 8px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' },
  tdNum: { padding: '4px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' },
  tdMoney: { padding: '4px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' },
  tdSvc: { padding: '4px 8px', borderBottom: '1px solid #f3f4f6', fontSize: 11 },
  trackCell: { cursor: 'pointer' },
  trackLink: { color: '#2563eb', textDecoration: 'underline', fontSize: 11 },
  pagination: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, justifyContent: 'center' },
  pageBtn: { padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', background: '#f9fafb' },
  pageInfo: { fontSize: 13, color: '#6b7280', padding: '0 8px' },
  empty: { color: '#9ca3af', fontStyle: 'italic', padding: 20 },
};
