import api from './client';

export const getAllocations = (params) => api.get('/allocations', { params });
export const createAllocation = (data) => api.post('/allocations', data);
export const reverseAllocation = (id, data) => api.delete(`/allocations/${id}`, { data });
