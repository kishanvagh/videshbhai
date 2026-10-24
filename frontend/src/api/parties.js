import api from './client';

export const getParties = (params) => api.get('/parties', { params });
export const createParty = (data) => api.post('/parties', data);
export const getParty = (id) => api.get(`/parties/${id}`);
export const updateParty = (id, data) => api.put(`/parties/${id}`, data);
export const getPartyLedger = (id, params) => api.get(`/parties/${id}/ledger`, { params });
export const getPartyBalances = (id) => api.get(`/parties/${id}/balances`);
