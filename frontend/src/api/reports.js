import api from './client';

export const getSalesReport = (params) => api.get('/reports/sales', { params });
export const getPaymentsReport = (params) => api.get('/reports/payments', { params });
export const getOutstandingReport = (params) => api.get('/reports/outstanding', { params });
export const getProfitReport = (params) => api.get('/reports/profit', { params });
export const getExchangeReport = (params) => api.get('/reports/currency-exchange', { params });
export const getPartyStatement = (id, params) => api.get(`/reports/party-statement/${id}`, { params });
export const exportCSV = (params) => api.get('/reports/export/csv', { params, responseType: 'blob' });
export const getMonthlyTrend = (params) => api.get('/reports/monthly-trend', { params });

