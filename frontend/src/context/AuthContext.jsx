import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi } from "../lib/api";

const AuthContext = createContext(null);
const TOKEN_KEY = "betdice_token";
const GROW_ID_KEY = "betdice_grow_id";

const normalizeBalance = (balance) => ({
  dl: Number(balance?.dl) || 0,
  bgl: Number(balance?.bgl) || 0,
  wl: Number(balance?.wl) || 0,
});

const getStoredToken = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || token === "undefined" || token === "null") {
    localStorage.removeItem(TOKEN_KEY);
    return "";
  }
  return token;
};

const saveSession = (token, user) => {
  if (!token || typeof token !== "string") throw new Error("Missing auth token");
  localStorage.setItem(TOKEN_KEY, token);
  if (user?.grow_id) localStorage.setItem(GROW_ID_KEY, user.grow_id);
};

const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(GROW_ID_KEY);
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const u = await authApi.me();
      setUser(u);
      if (u?.grow_id) localStorage.setItem(GROW_ID_KEY, u.grow_id);
    } catch (e) {
      clearSession();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (growId, password) => {
    const payload = await authApi.login(growId, password);
    const token = payload?.token || payload?.access_token;
    const u = payload?.user;
    if (!token || !u) throw new Error("Invalid login response from server");
    saveSession(token, u);
    setUser(u);
    return u;
  };

  const register = async (growId, password) => {
    const payload = await authApi.register(growId, password);
    const token = payload?.token || payload?.access_token;
    const u = payload?.user;
    if (!token || !u) throw new Error("Invalid register response from server");
    saveSession(token, u);
    setUser(u);
    return u;
  };

  const refresh = async () => {
    try {
      const u = await authApi.me();
      setUser(u);
      return u;
    } catch (e) {
      clearSession();
      setUser(null);
    }
  };

  const logout = () => {
    clearSession();
    setUser(null);
  };

  const balance = normalizeBalance(user?.balance);

  return (
    <AuthContext.Provider value={{ user, balance, login, register, logout, refresh, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
