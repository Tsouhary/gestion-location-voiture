import axios from 'axios';

const TOKEN_KEY = 'parc_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Jeton expiré ou compte désactivé : on prévient l'AuthContext, qui renvoie vers la page de connexion.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes('/auth/login')) {
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(err);
  },
);

export const errorMessage = (err) =>
  err.response?.data?.message || (err.response ? 'Une erreur est survenue' : 'Serveur injoignable');

export default api;
