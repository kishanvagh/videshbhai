import api from './client';
export const getOpeningBalances = (params) => api.get('/opening-balances', { params });
export const createOpeningBalance = (data) => api.post('/opening-balances', data);
export const updateOpeningBalance = (id, data) => api.put(`/opening-balances/${id}`, data);
export const deleteOpeningBalance = (id) => api.delete(`/opening-balances/${id}`);
