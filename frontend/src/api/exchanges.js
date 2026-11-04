import api from './client';

export const getExchanges = (params) => api.get('/exchanges', { params });
export const createExchange = (data) => api.post('/exchanges', data);
export const updateExchange = (id, data) => api.put(`/exchanges/${id}`, data);
export const reverseExchange = (id, data) => api.post(`/exchanges/${id}/reverse`, data);
export const getCurrencyBalances = () => api.get('/exchanges/currency-balances');
export const deleteExchange = (id) => api.delete(`/exchanges/${id}`);
export const getExchangeINRPayments = (exchangeId) => api.get(`/exchanges/${exchangeId}/inr-payments`);
export const addExchangeINRPayment = (exchangeId, data) => api.post(`/exchanges/${exchangeId}/inr-payments`, data);
export const deleteExchangeINRPayment = (exchangeId, paymentId) => api.delete(`/exchanges/${exchangeId}/inr-payments/${paymentId}`);

// Wallet adjustment APIs
export const getWalletAdjustments = (params) => api.get('/wallet/adjustments', { params });
export const createWalletAdjustment = (data) => api.post('/wallet/adjustments', data);
export const updateWalletAdjustment = (id, data) => api.put(`/wallet/adjustments/${id}`, data);
export const deleteWalletAdjustment = (id) => api.delete(`/wallet/adjustments/${id}`);
