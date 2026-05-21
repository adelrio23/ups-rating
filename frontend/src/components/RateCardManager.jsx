import React, { useState, useEffect } from 'react';
import { uploadRateCard, listRateCards, deleteRateCard } from '../api';

const SERVICE_LABELS = {
  ground_commercial: 'Ground Commercial',
  ground_residential: 'Ground Residential',
  '2da': '2nd Day Air',
  nda: 'Next Day Air',
};

export default function RateCardManager({ onCardsChange }) {
  const [cards, setCards] = useState([]);
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    const { data } = await listRateCards();
    setCards(data);
    if (onCardsChange) onCardsChange(data);
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async () => {
    if (!file || !name.trim()) {
      setError('Provide a file and a name for the rate card.');
      return;
    }
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await uploadRateCard(file, name.trim());
      setSuccess(`Uploaded: ${data.services_found.join(', ')} (${data.rate_cards.length} service tabs)`);
      setFile(null);
      setName('');
      load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteRateCard(id);
    load();
  };

  // Group cards by name
  const grouped = cards.reduce((acc, c) => {
    acc[c.name] = acc[c.name] || [];
    acc[c.name].push(c);
    return acc;
  }, {});

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Rate Cards</h2>
      <p style={styles.sub}>Upload carrier rate Excel files. Each sheet = one service type (Ground, 2DA, NDA).</p>

      <div style={styles.uploadBox}>
        <input
          type="text"
          placeholder="Name (e.g. OctoChem UPS 2025)"
          value={name}
          onChange={e => setName(e.target.value)}
          style={styles.input}
        />
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={e => setFile(e.target.files[0])}
          style={styles.fileInput}
        />
        <button onClick={handleUpload} disabled={uploading} style={styles.btn}>
          {uploading ? 'Uploading…' : 'Upload Rate Card'}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <div style={styles.hint}>
        <strong>Expected format:</strong> Row 1 = zone headers (2, 3, 4, 5, 6, 7, 8), Column A = weight (1–150 lbs).
        Each sheet tab should be named: Ground, Ground Residential, 2nd Day Air, Next Day Air.
      </div>

      {Object.keys(grouped).length === 0 && (
        <p style={styles.empty}>No rate cards uploaded yet.</p>
      )}

      {Object.entries(grouped).map(([groupName, groupCards]) => (
        <div key={groupName} style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardName}>{groupName}</span>
            <button
              onClick={() => groupCards.forEach(c => handleDelete(c.id))}
              style={styles.deleteBtn}
            >
              Delete All
            </button>
          </div>
          <div style={styles.serviceRow}>
            {groupCards.map(c => (
              <span key={c.id} style={styles.serviceTag}>
                {SERVICE_LABELS[c.service_type] || c.service_type} ({c.weight_count} weights)
              </span>
            ))}
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
  input: {
    padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6,
    fontSize: 14, flex: 1, minWidth: 200,
  },
  fileInput: { padding: '6px 0', fontSize: 13 },
  btn: {
    padding: '8px 18px', background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
  error: { color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 6, marginBottom: 8 },
  success: { color: '#16a34a', background: '#f0fdf4', padding: '8px 12px', borderRadius: 6, marginBottom: 8 },
  hint: {
    background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6,
    padding: '10px 14px', fontSize: 12, color: '#1e40af', marginBottom: 16,
  },
  empty: { color: '#9ca3af', fontStyle: 'italic' },
  card: {
    border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, marginBottom: 10,
    background: '#fff',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardName: { fontWeight: 700, fontSize: 15 },
  deleteBtn: {
    padding: '4px 10px', background: '#fee2e2', color: '#dc2626',
    border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: 12,
  },
  serviceRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  serviceTag: {
    background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
    borderRadius: 12, padding: '2px 10px', fontSize: 12,
  },
};
