import api from './client';

export const getDashboardSummary = (params) => api.get('/dashboard/summary', { params });
export const getPartyTable = (params) => api.get('/dashboard/party-table', { params });
export const getCurrencyPositions = () => api.get('/dashboard/currency-positions');
