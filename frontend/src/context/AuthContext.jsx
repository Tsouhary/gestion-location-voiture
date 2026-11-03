import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { tokenStore } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  useEffect(() => {
    if (!tokenStore.get()) return;
    api.get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    tokenStore.set(res.data.token);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* la déconnexion locale suffit */
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, setUser, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
