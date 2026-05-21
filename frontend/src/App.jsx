import React, { useState, useEffect, useCallback, useRef } from 'react';
import { listRateCards, listInvoices, runScenario } from './api';
import RateCardManager from './components/RateCardManager';
import InvoiceManager from './components/InvoiceManager';
import FuelConfig from './components/FuelConfig';
import MarkupEngine from './components/MarkupEngine';
import PackageTable from './components/PackageTable';
import RateGrid from './components/RateGrid';
import AuditModal from './components/AuditModal';
import ScenarioComparison from './components/ScenarioComparison';
import AccessorialConfig from './components/AccessorialConfig';
import ExportPanel from './components/ExportPanel';

const TABS = [
  { id: 'setup', label: 'Setup' },
  { id: 'engine', label: 'Pricing Engine' },
  { id: 'grid', label: 'Rate Grids' },
  { id: 'packages', label: 'Package Detail' },
  { id: 'export', label: 'Export' },
  { id: 'scenarios', label: 'Scenarios' },
];

export default function App() {
  const [tab, setTab] = useState('setup');
  const [rateCards, setRateCards] = useState([]);
  const [invoiceId, setInvoiceId] = useState(null);
  const [selectedCardIds, setSelectedCardIds] = useState([]);
  const [markup, setMarkup] = useState(5.0);
  const [fuelConfig, setFuelConfig] = useState({
    ourFuelPct: 12.8,
    publishedFuelPct: 17.1,
    customerFuelPct: 17.1,
  });
  const [volumeMultiplier, setVolumeMultiplier] = useState(1.0);
  const [accessorialConfig, setAccessorialConfig] = useState({});
  const [scenarioName, setScenarioName] = useState('');

  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const [auditPkg, setAuditPkg] = useState(null);
  const [auditCell, setAuditCell] = useState(null);
  const debounceRef = useRef(null);

  const loadCards = async () => {
    const { data } = await listRateCards();
    setRateCards(data);
  };

  useEffect(() => { loadCards(); }, []);

  // Auto-select all rate cards
  useEffect(() => {
    const ids = rateCards.map(c => c.id);
    setSelectedCardIds(ids);
  }, [rateCards]);

  const handleRun = useCallback(async (markupOverride) => {
    if (!invoiceId || selectedCardIds.length === 0) return;
    setRunning(true);
    setRunError('');
    try {
      const { data } = await runScenario({
        name: scenarioName || `Run ${new Date().toLocaleTimeString()}`,
        invoice_id: invoiceId,
        rate_card_ids: selectedCardIds,
        markup_pct: markupOverride ?? markup,
        our_fuel_pct: fuelConfig.ourFuelPct,
        published_fuel_pct: fuelConfig.publishedFuelPct,
        customer_fuel_pct: fuelConfig.customerFuelPct,
        volume_multiplier: volumeMultiplier,
        accessorial_config: accessorialConfig,
      });
      setResult(data);
    } catch (e) {
      setRunError(e.response?.data?.detail || e.message);
    } finally {
      setRunning(false);
    }
  }, [invoiceId, selectedCardIds, markup, fuelConfig, volumeMultiplier, accessorialConfig, scenarioName]);

  // Debounced re-run on markup change
  const handleMarkupChange = (val) => {
    setMarkup(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleRun(val), 600);
  };

  // Grouped card names for selection UI
  const groupedCards = rateCards.reduce((acc, c) => {
    acc[c.name] = acc[c.name] || [];
    acc[c.name].push(c);
    return acc;
  }, {});

  const cardNamesSelected = [...new Set(
    rateCards.filter(c => selectedCardIds.includes(c.id)).map(c => c.name)
  )];

  const toggleCardGroup = (name) => {
    const ids = rateCards.filter(c => c.name === name).map(c => c.id);
    const allSelected = ids.every(id => selectedCardIds.includes(id));
    if (allSelected) {
      setSelectedCardIds(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedCardIds(prev => [...new Set([...prev, ...ids])]);
    }
  };

  const canRun = invoiceId && selectedCardIds.length > 0;

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.logo}>Parcel Pricing Engine</div>
        <nav style={styles.nav}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ ...styles.navBtn, ...(tab === t.id ? styles.navActive : {}) }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main style={styles.main}>

        {tab === 'setup' && (
          <div style={styles.twoCol}>
            <div style={styles.colLeft}>
              <RateCardManager onCardsChange={setRateCards} />
            </div>
            <div style={styles.colRight}>
              <InvoiceManager onInvoiceSelect={setInvoiceId} selectedInvoiceId={invoiceId} />
            </div>
          </div>
        )}

        {tab === 'engine' && (
          <div>
            <div style={styles.engineTop}>
              <div style={styles.engineLeft}>
                <FuelConfig config={fuelConfig} onChange={setFuelConfig} />

                <div style={styles.section}>
                  <h3 style={styles.sectionHeading}>Volume Multiplier</h3>
                  <div style={styles.row}>
                    <label style={styles.smallLabel}>Scale invoice to monthly volume</label>
                    <input
                      type="number" min={0.1} max={100} step={0.1}
                      value={volumeMultiplier}
                      onChange={e => setVolumeMultiplier(parseFloat(e.target.value) || 1)}
                      style={styles.smallInput}
                    />
                    <span style={styles.hint2}>× invoice packages</span>
                  </div>
                </div>

                <div style={styles.section}>
                  <h3 style={styles.sectionHeading}>Rate Cards to Use</h3>
                  <div style={styles.cardCheckboxes}>
                    {Object.keys(groupedCards).map(name => (
                      <label key={name} style={styles.cardCheck}>
                        <input
                          type="checkbox"
                          checked={groupedCards[name].every(c => selectedCardIds.includes(c.id))}
                          onChange={() => toggleCardGroup(name)}
                        />
                        {name}
                      </label>
                    ))}
                    {Object.keys(groupedCards).length === 0 && (
                      <span style={styles.emptyHint}>No rate cards — upload them in Setup.</span>
                    )}
                  </div>
                </div>

                <div style={styles.section}>
                  <h3 style={styles.sectionHeading}>Scenario Name</h3>
                  <input
                    value={scenarioName}
                    onChange={e => setScenarioName(e.target.value)}
                    placeholder="e.g. ABC Corp — 5% markup"
                    style={styles.fullInput}
                  />
                </div>

                <AccessorialConfig config={accessorialConfig} onChange={setAccessorialConfig} />
              </div>

              <div style={styles.engineRight}>
                <MarkupEngine
                  markup={markup}
                  onMarkupChange={handleMarkupChange}
                  summary={result?.summary}
                  running={running}
                />

                <div style={styles.runRow}>
                  <button
                    onClick={() => handleRun()}
                    disabled={!canRun || running}
                    style={{ ...styles.runBtn, ...((!canRun || running) ? styles.runDisabled : {}) }}
                  >
                    {running ? 'Running…' : 'Run / Refresh'}
                  </button>
                  {!invoiceId && <span style={styles.runHint}>Select invoice in Setup tab first.</span>}
                  {invoiceId && selectedCardIds.length === 0 && <span style={styles.runHint}>Select at least one rate card.</span>}
                </div>

                {runError && <div style={styles.runError}>{runError}</div>}

                {result?.truncated && (
                  <div style={styles.truncated}>
                    Showing first 2,000 of {result.total_package_count.toLocaleString()} packages in detail view.
                    Summaries and exports use all packages.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'grid' && (
          <div>
            <h2 style={styles.tabHeading}>Rate Source Maps</h2>
            {result ? (
              <RateGrid
                rateSourceMaps={result.rate_source_maps}
                markup={markup}
                ourFuel={fuelConfig.ourFuelPct}
                customerFuel={fuelConfig.customerFuelPct}
                onCellAudit={setAuditCell}
              />
            ) : (
              <p style={styles.emptyTab}>Run a scenario first to generate rate grids.</p>
            )}
          </div>
        )}

        {tab === 'packages' && (
          <div>
            <h2 style={styles.tabHeading}>Package-Level Detail</h2>
            <PackageTable
              packages={result?.packages}
              onAuditClick={setAuditPkg}
            />
          </div>
        )}

        {tab === 'export' && (
          <ExportPanel
            invoiceId={invoiceId}
            rateCardIds={selectedCardIds}
            markup={markup}
            fuelConfig={fuelConfig}
            volumeMultiplier={volumeMultiplier}
            accessorialConfig={accessorialConfig}
          />
        )}

        {tab === 'scenarios' && <ScenarioComparison />}
      </main>

      {auditPkg && (
        <AuditModal pkg={auditPkg} onClose={() => setAuditPkg(null)} />
      )}

      {auditCell && (
        <CellAuditModal cell={auditCell} markup={markup} fuelConfig={fuelConfig} onClose={() => setAuditCell(null)} />
      )}
    </div>
  );
}

function CellAuditModal({ cell, markup, fuelConfig, onClose }) {
  const { weight, zone, service, cell: c } = cell;
  const rate = c?.rate;
  const costBase = rate != null ? rate * (1 + (fuelConfig?.ourFuelPct ?? 0) / 100) : null;
  const sellBase = rate != null ? rate * (1 + (markup ?? 0) / 100) : null;
  const sellFuel = sellBase != null ? sellBase * (fuelConfig?.customerFuelPct ?? 0) / 100 : null;

  const fmt = (n) => n == null ? '—' : `$${Number(n).toFixed(4)}`;

  return (
    <div style={styles2.overlay} onClick={onClose}>
      <div style={styles2.modal} onClick={e => e.stopPropagation()}>
        <div style={styles2.header}>
          <h3 style={styles2.title}>Cell Audit — W{weight} / Z{zone} / {service}</h3>
          <button onClick={onClose} style={styles2.close}>✕</button>
        </div>
        <table style={styles2.table}>
          <tbody>
            {[
              ['Carrier', c?.carrier_name || '—'],
              ['Best Rate', fmt(rate)],
              ['Our Fuel %', `${(fuelConfig?.ourFuelPct ?? 0).toFixed(1)}%`],
              ['Our Cost Base', fmt(costBase)],
              ['Markup %', `${(markup ?? 0).toFixed(1)}%`],
              ['Sell Base', fmt(sellBase)],
              ['Customer Fuel %', `${(fuelConfig?.customerFuelPct ?? 0).toFixed(1)}%`],
              ['Sell Fuel', fmt(sellFuel)],
              ['Sell Total (before acc)', fmt(sellBase != null && sellFuel != null ? sellBase + sellFuel : null)],
            ].map(([l, v]) => (
              <tr key={l}>
                <td style={styles2.tdL}>{l}</td>
                <td style={styles2.tdR}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  app: { minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: {
    background: '#1e3a5f', color: '#fff', padding: '0 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    height: 52, position: 'sticky', top: 0, zIndex: 100,
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  logo: { fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px' },
  nav: { display: 'flex', gap: 2 },
  navBtn: {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer', padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500,
  },
  navActive: { background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700 },
  main: { maxWidth: 1400, margin: '0 auto', padding: '24px 20px' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
  colLeft: { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  colRight: { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  engineTop: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
  engineLeft: { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  engineRight: { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  section: { marginTop: 20 },
  sectionHeading: { fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#374151' },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  smallLabel: { fontSize: 13, color: '#6b7280' },
  smallInput: { width: 70, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 },
  hint2: { fontSize: 12, color: '#9ca3af' },
  cardCheckboxes: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  cardCheck: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' },
  emptyHint: { color: '#9ca3af', fontSize: 12, fontStyle: 'italic' },
  fullInput: { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 },
  runRow: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 },
  runBtn: {
    padding: '10px 24px', background: '#16a34a', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 700,
  },
  runDisabled: { background: '#d1d5db', color: '#9ca3af', cursor: 'not-allowed' },
  runHint: { color: '#d97706', fontSize: 12 },
  runError: { color: '#dc2626', background: '#fef2f2', borderRadius: 6, padding: '8px 12px', marginTop: 8, fontSize: 13 },
  truncated: { background: '#fefce8', border: '1px solid #fef08a', borderRadius: 6, padding: '8px 12px', marginTop: 8, fontSize: 12, color: '#854d0e' },
  tabHeading: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  emptyTab: { color: '#9ca3af', fontStyle: 'italic' },
};

const styles2 = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 10, padding: 20, width: 380, boxShadow: '0 16px 48px rgba(0,0,0,0.2)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 14, fontWeight: 700, margin: 0 },
  close: { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#9ca3af' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  tdL: { padding: '4px 0', color: '#6b7280', width: '55%' },
  tdR: { padding: '4px 0', textAlign: 'right', fontWeight: 600 },
};
