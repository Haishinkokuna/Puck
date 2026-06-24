// src/api/client.js
// Axios instance — the single HTTP client for ALL API calls.
// Why a shared instance? So we set the base URL and auth header ONCE.
// Every API file imports this and just calls client.get('/boards') etc.
import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attaches the JWT token to every outgoing request.
// We read it from localStorage here so we don't have to pass it manually
// to every single API call.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — handles 401 globally.
// If any request returns 401 (token expired), log the user out automatically
// instead of showing confusing errors on every protected page.
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // hard redirect to login
    }
    return Promise.reject(err);
  }
);

export default client;
