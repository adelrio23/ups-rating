import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const uploadRateCard = (file, name) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('name', name);
  return api.post('/rate-cards/upload', fd);
};

export const listRateCards = () => api.get('/rate-cards');
export const deleteRateCard = (id) => api.delete(`/rate-cards/${id}`);
export const previewRateCard = (id) => api.get(`/rate-cards/${id}/preview`);

export const uploadInvoice = (file, name) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('name', name);
  return api.post('/invoices/upload', fd);
};

export const listInvoices = () => api.get('/invoices');
export const deleteInvoice = (id) => api.delete(`/invoices/${id}`);

export const runScenario = (payload) => api.post('/scenarios/run', payload);
export const listScenarios = () => api.get('/scenarios');
export const deleteScenario = (id) => api.delete(`/scenarios/${id}`);

export const exportCustomerExcel = (payload) =>
  api.post('/export/customer-excel', payload, { responseType: 'blob' });
export const exportInternalExcel = (payload) =>
  api.post('/export/internal-excel', payload, { responseType: 'blob' });
export const exportDealBrief = (payload) =>
  api.post('/export/deal-brief', payload, { responseType: 'blob' });

export const auditCell = (params) => api.post('/audit/cell', null, { params });

export const listAccessorials = () => api.get('/accessorials');
export const saveAccessorials = (name, config) =>
  api.post('/accessorials', config, { params: { name } });

export default api;
