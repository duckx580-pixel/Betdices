import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const token = localStorage.getItem("betdice_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const u = await authApi.me();
      setUser(u);
    } catch (e) {
      localStorage.removeItem("betdice_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (growId) => {
    const { token, user: u } = await authApi.login(growId);
    localStorage.setItem("betdice_token", token);
    setUser(u);
    return u;
  };

  const refresh = async () => {
    try {
      const u = await authApi.me();
      setUser(u);
      return u;
    } catch (e) {
      // ignore
    }
  };

  const logout = () => {
    localStorage.removeItem("betdice_token");
    setUser(null);
  };

  const balance = user?.balance || { dl: 0, bgl: 0, wl: 0 };

  return (
    <AuthContext.Provider value={{ user, balance, login, logout, refresh, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
