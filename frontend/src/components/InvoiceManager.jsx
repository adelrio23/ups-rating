import React, { useState, useEffect } from 'react';
import { uploadInvoice, listInvoices, deleteInvoice } from '../api';

const SERVICE_LABELS = {
  ground_commercial: 'GC',
  ground_residential: 'GR',
  '2da': '2DA',
  nda: 'NDA',
  '3da': '3DA',
  unknown: '?',
};

export default function InvoiceManager({ onInvoiceSelect, selectedInvoiceId }) {
  const [invoices, setInvoices] = useState([]);
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadResult, setUploadResult] = useState(null);

  const load = async () => {
    const { data } = await listInvoices();
    setInvoices(data);
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async () => {
    if (!file || !name.trim()) { setError('Provide file and name.'); return; }
    setUploading(true); setError(''); setUploadResult(null);
    try {
      const { data } = await uploadInvoice(file, name.trim());
      setUploadResult(data);
      setFile(null); setName('');
      load();
      if (onInvoiceSelect) onInvoiceSelect(data.id);
    } catch (e) {
      setError(e.response?.data?.detail || 'Upload failed');
    } finally { setUploading(false); }
  };

  const handleDelete = async (id) => {
    await deleteInvoice(id);
    load();
    if (selectedInvoiceId === id && onInvoiceSelect) onInvoiceSelect(null);
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Customer Invoice</h2>
      <p style={styles.sub}>Upload carrier invoice Excel. Auto-detects weight, zone, service, charges.</p>

      <div style={styles.uploadBox}>
        <input
          type="text"
          placeholder="Name (e.g. ABC Corp Jan 2025)"
          value={name}
          onChange={e => setName(e.target.value)}
          style={styles.input}
        />
        <input type="file" accept=".xlsx,.xls" onChange={e => setFile(e.target.files[0])} style={styles.fileInput} />
        <button onClick={handleUpload} disabled={uploading} style={styles.btn}>
          {uploading ? 'Uploading…' : 'Upload Invoice'}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {uploadResult && (
        <div style={styles.result}>
          <strong>Parsed:</strong> {uploadResult.total_packages.toLocaleString()} packages
          {uploadResult.corrections_flagged > 0 && (
            <span style={styles.correction}> · {uploadResult.corrections_flagged} corrections flagged</span>
          )}
          {uploadResult.fuel_pct_detected && (
            <span style={styles.fuel}> · Detected fuel: ~{uploadResult.fuel_pct_detected}%</span>
          )}
          {!uploadResult.auto_detected && (
            <span style={styles.warn}> · Auto-detect incomplete — check mapping</span>
          )}
          <div style={styles.breakdown}>
            {Object.entries(uploadResult.service_breakdown || {}).map(([svc, cnt]) => (
              <span key={svc} style={styles.tag}>{SERVICE_LABELS[svc] || svc}: {cnt}</span>
            ))}
            {Object.entries(uploadResult.zone_breakdown || {}).map(([z, cnt]) => (
              <span key={z} style={styles.tagZone}>Z{z}: {cnt}</span>
            ))}
          </div>
          <div style={styles.colMap}>
            <strong>Column mapping:</strong>{' '}
            {Object.entries(uploadResult.column_mapping || {}).map(([k, v]) => (
              <span key={k} style={styles.mapItem}>{k}→<em>{v}</em></span>
            ))}
          </div>
        </div>
      )}

      {invoices.length === 0 && <p style={styles.empty}>No invoices uploaded.</p>}

      {invoices.map(inv => (
        <div
          key={inv.id}
          onClick={() => onInvoiceSelect && onInvoiceSelect(inv.id)}
          style={{
            ...styles.card,
            ...(selectedInvoiceId === inv.id ? styles.cardSelected : {}),
            cursor: 'pointer',
          }}
        >
          <div style={styles.cardRow}>
            <div>
              <span style={styles.invName}>{inv.name}</span>
              <span style={styles.invCount}>{inv.total_packages.toLocaleString()} packages</span>
            </div>
            <button onClick={e => { e.stopPropagation(); handleDelete(inv.id); }} style={styles.deleteBtn}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: { padding: '0 0 24px' },
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  sub: { color: '#666', fontSize: 13, marginBottom: 16 },
  uploadBox: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  input: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, flex: 1, minWidth: 200 },
  fileInput: { padding: '6px 0', fontSize: 13 },
  btn: { padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  error: { color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 6, marginBottom: 8 },
  result: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '10px 14px', marginBottom: 12, fontSize: 13 },
  correction: { color: '#d97706' },
  fuel: { color: '#2563eb' },
  warn: { color: '#dc2626' },
  breakdown: { marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' },
  tag: { background: '#dbeafe', color: '#1d4ed8', borderRadius: 10, padding: '1px 8px', fontSize: 11 },
  tagZone: { background: '#f3f4f6', color: '#374151', borderRadius: 10, padding: '1px 8px', fontSize: 11 },
  colMap: { marginTop: 6, fontSize: 11, color: '#6b7280' },
  mapItem: { marginRight: 8 },
  empty: { color: '#9ca3af', fontStyle: 'italic' },
  card: { border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 8, background: '#fff' },
  cardSelected: { border: '2px solid #2563eb', background: '#eff6ff' },
  cardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  invName: { fontWeight: 600, fontSize: 14, marginRight: 8 },
  invCount: { color: '#6b7280', fontSize: 12 },
  deleteBtn: { padding: '3px 8px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: 12 },
};
