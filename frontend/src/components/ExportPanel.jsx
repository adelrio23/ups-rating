import React, { useState } from 'react';
import { exportCustomerExcel, exportInternalExcel, exportDealBrief } from '../api';

function downloadBlob(data, filename, mime) {
  const url = window.URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

export default function ExportPanel({ invoiceId, rateCardIds, markup, fuelConfig, volumeMultiplier, accessorialConfig }) {
  const [scenarioName, setScenarioName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [strategy, setStrategy] = useState('');
  const [risks, setRisks] = useState('');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  const payload = {
    invoice_id: invoiceId,
    rate_card_ids: rateCardIds,
    markup_pct: markup,
    our_fuel_pct: fuelConfig?.ourFuelPct ?? 12.8,
    customer_fuel_pct: fuelConfig?.customerFuelPct ?? 17.1,
    volume_multiplier: volumeMultiplier ?? 1.0,
    accessorial_config: accessorialConfig || {},
    scenario_name: scenarioName || 'Proposal',
    account_name: accountName || 'Account',
    strategy_notes: strategy,
    risks,
  };

  const canExport = invoiceId && rateCardIds?.length > 0;

  const doExport = async (type) => {
    if (!canExport) { setError('Select invoice and rate cards first.'); return; }
    setLoading(type); setError('');
    try {
      if (type === 'customer') {
        const r = await exportCustomerExcel(payload);
        downloadBlob(r.data, `${payload.scenario_name}_customer.xlsx`,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else if (type === 'internal') {
        const r = await exportInternalExcel(payload);
        downloadBlob(r.data, `${payload.scenario_name}_internal.xlsx`,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else if (type === 'brief') {
        const r = await exportDealBrief(payload);
        downloadBlob(r.data, `${payload.account_name}_deal_brief.docx`,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      }
    } catch (e) {
      setError(e.response?.data?.detail || `Export failed: ${e.message}`);
    } finally { setLoading(''); }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>Export Proposals</h3>

      <div style={styles.grid}>
        <label style={styles.label}>
          Scenario / Proposal Name
          <input value={scenarioName} onChange={e => setScenarioName(e.target.value)}
            placeholder="e.g. ABC Corp v2 — 5% markup"
            style={styles.input} />
        </label>
        <label style={styles.label}>
          Account Name (for Deal Brief)
          <input value={accountName} onChange={e => setAccountName(e.target.value)}
            placeholder="e.g. ABC Corp"
            style={styles.input} />
        </label>
      </div>

      <label style={styles.label}>
        Strategy Notes (optional)
        <textarea value={strategy} onChange={e => setStrategy(e.target.value)}
          placeholder="Key context for the deal brief…"
          rows={3} style={styles.textarea} />
      </label>

      <label style={styles.label}>
        Risks (optional)
        <textarea value={risks} onChange={e => setRisks(e.target.value)}
          placeholder="Key risks to highlight…"
          rows={2} style={styles.textarea} />
      </label>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.btnRow}>
        <ExportBtn
          label="Customer Excel"
          desc="Rate grids, package comparison, accessorials"
          color="#16a34a"
          loading={loading === 'customer'}
          onClick={() => doExport('customer')}
          disabled={!canExport}
        />
        <ExportBtn
          label="Internal Excel"
          desc="Exec summary, rate source map, cost/sell/margin grids, pkg P&L"
          color="#1d4ed8"
          loading={loading === 'internal'}
          onClick={() => doExport('internal')}
          disabled={!canExport}
        />
        <ExportBtn
          label="Deal Brief (Word)"
          desc="Account overview, economics, pitch script, billing workflow"
          color="#7c3aed"
          loading={loading === 'brief'}
          onClick={() => doExport('brief')}
          disabled={!canExport}
        />
      </div>

      {!canExport && (
        <div style={styles.warn}>Select an invoice and at least one rate card before exporting.</div>
      )}
    </div>
  );
}

function ExportBtn({ label, desc, color, loading, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...styles.exportBtn,
        background: disabled ? '#f3f4f6' : color,
        color: disabled ? '#9ca3af' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <div style={styles.exportLabel}>{loading ? 'Generating…' : label}</div>
      <div style={{ ...styles.exportDesc, color: disabled ? '#9ca3af' : 'rgba(255,255,255,0.8)' }}>{desc}</div>
    </button>
  );
}

const styles = {
  container: { padding: '8px 0 16px' },
  heading: { fontSize: 16, fontWeight: 700, marginBottom: 12 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
  label: { display: 'flex', flexDirection: 'column', fontSize: 13, fontWeight: 600, color: '#374151', gap: 4, marginBottom: 10 },
  input: { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, fontWeight: 400 },
  textarea: { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, fontWeight: 400, resize: 'vertical' },
  error: { color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 6, marginBottom: 10, fontSize: 13 },
  btnRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  exportBtn: {
    flex: '1 1 180px', border: 'none', borderRadius: 8,
    padding: '14px 16px', textAlign: 'left', transition: 'opacity 0.15s',
  },
  exportLabel: { fontWeight: 700, fontSize: 14, marginBottom: 4 },
  exportDesc: { fontSize: 11, lineHeight: 1.4 },
  warn: { color: '#d97706', fontSize: 12, marginTop: 8 },
};
