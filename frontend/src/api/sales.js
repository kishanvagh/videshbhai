import api from './client';

export const getSales = (params) => api.get('/sales', { params });
export const createSale = (data) => api.post('/sales', data);
export const getSale = (id) => api.get(`/sales/${id}`);
export const updateSale = (id, data) => api.put(`/sales/${id}`, data);
export const cancelSale = (id, data) => api.post(`/sales/${id}/cancel`, data);
