import axios from 'axios';

// Normalize the API base URL so that whether the deploy env var is set to
// "https://api.example.com" or "https://api.example.com/api", requests always
// hit the correct "/api" route prefix. Without this, a base URL missing the
// "/api" segment makes every call (e.g. /auth/register) hit a non-existent
// path and the backend replies "Route ... not found".
const rawBaseURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const BASE_URL = rawBaseURL.endsWith('/api') ? rawBaseURL : `${rawBaseURL}/api`;

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jewel_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('jewel_token');
      localStorage.removeItem('jewel_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
