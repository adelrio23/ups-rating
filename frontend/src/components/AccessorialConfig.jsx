import React, { useState } from 'react';

const ACCESSORIALS = [
  { key: 'das', label: 'Delivery Area Surcharge (DAS)' },
  { key: 'das_extended', label: 'DAS Extended' },
  { key: 'residential', label: 'Residential Delivery' },
  { key: 'address_correction', label: 'Address Correction' },
  { key: 'additional_handling', label: 'Additional Handling' },
  { key: 'declared_value', label: 'Declared Value / Insurance' },
];

const DEFAULT_CONFIG = ACCESSORIALS.reduce((acc, { key }) => ({
  ...acc,
  [key]: { passthrough: true, our_rate: '', customer_rate: '' },
}), {});

export default function AccessorialConfig({ config, onChange }) {
  const cfg = config || DEFAULT_CONFIG;

  const set = (key, field, val) => {
    onChange({
      ...cfg,
      [key]: { ...cfg[key], [field]: field === 'passthrough' ? val : (parseFloat(val) || '') },
    });
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>Accessorial Configuration</h3>
      <p style={styles.sub}>
        Passthrough = use customer's invoice amount. Custom = override with your negotiated rate.
      </p>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Accessorial</th>
            <th style={styles.th}>Mode</th>
            <th style={styles.th}>Our Rate ($)</th>
            <th style={styles.th}>Customer Rate ($)</th>
          </tr>
        </thead>
        <tbody>
          {ACCESSORIALS.map(({ key, label }) => {
            const ac = cfg[key] || { passthrough: true };
            return (
              <tr key={key}>
                <td style={styles.td}>{label}</td>
                <td style={styles.td}>
                  <label style={styles.radioLabel}>
                    <input
                      type="radio"
                      checked={ac.passthrough !== false}
                      onChange={() => set(key, 'passthrough', true)}
                    />
                    Passthrough
                  </label>
                  <label style={{ ...styles.radioLabel, marginLeft: 12 }}>
                    <input
                      type="radio"
                      checked={ac.passthrough === false}
                      onChange={() => set(key, 'passthrough', false)}
                    />
                    Custom
                  </label>
                </td>
                <td style={styles.td}>
                  <input
                    type="number" step="0.01" min="0"
                    placeholder="e.g. 4.50"
                    value={ac.our_rate || ''}
                    disabled={ac.passthrough !== false}
                    onChange={e => set(key, 'our_rate', e.target.value)}
                    style={{ ...styles.numInput, ...(ac.passthrough !== false ? styles.disabled : {}) }}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    type="number" step="0.01" min="0"
                    placeholder="e.g. 5.00"
                    value={ac.customer_rate || ''}
                    disabled={ac.passthrough !== false}
                    onChange={e => set(key, 'customer_rate', e.target.value)}
                    style={{ ...styles.numInput, ...(ac.passthrough !== false ? styles.disabled : {}) }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  container: { padding: '8px 0 16px' },
  heading: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  sub: { color: '#6b7280', fontSize: 12, marginBottom: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { background: '#f3f4f6', padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' },
  td: { padding: '7px 12px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  radioLabel: { display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12 },
  numInput: { padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, width: 90, fontSize: 13 },
  disabled: { background: '#f9fafb', color: '#9ca3af' },
};
