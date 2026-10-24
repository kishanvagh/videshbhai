import api from './client';

export const getExchanges = (params) => api.get('/exchanges', { params });
export const createExchange = (data) => api.post('/exchanges', data);
export const updateExchange = (id, data) => api.put(`/exchanges/${id}`, data);
export const reverseExchange = (id, data) => api.post(`/exchanges/${id}/reverse`, data);
export const getCurrencyBalances = () => api.get('/exchanges/currency-balances');
