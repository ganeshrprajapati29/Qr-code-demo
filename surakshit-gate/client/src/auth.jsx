import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { get, post, setUnauthorizedHandler } from './api.js';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, school: null });

  const refresh = useCallback(async () => {
    try {
      const r = await get('/auth/me', { silent401: true });
      setState({ loading: false, user: r.user, school: r.school });
    } catch {
      setState({ loading: false, user: null, school: null });
    }
  }, []);

  useEffect(() => {
    refresh();
    setUnauthorizedHandler(() => setState((s) => ({ ...s, user: null })));
  }, [refresh]);

  const login = async (username, password) => {
    await post('/auth/login', { username, password });
    await refresh();
  };
  const logout = async () => {
    await post('/auth/logout').catch(() => {});
    setState({ loading: false, user: null, school: null });
  };
  return <Ctx.Provider value={{ ...state, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export const can = (user, ...roles) => Boolean(user && roles.includes(user.role));
