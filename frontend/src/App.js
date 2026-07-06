import { useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import Wallet from "./pages/Wallet";
import Chat from "./pages/Chat";
import GamePlay from "./pages/GamePlay";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import { AuthProvider, useAuth } from "./context/AuthContext";

function PrivateRoute({ children, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-white/10 border-t-[#3583ff] animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !user.is_admin) return <Navigate to="/" replace />;
  return children;
}

function App() {
  useEffect(() => {
    document.title = "BetDice - Gaming Platform";
  }, []);

  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<PrivateRoute adminOnly><Admin /></PrivateRoute>} />
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Home />} />
              <Route path="browse" element={<Browse />} />
              <Route path="wallet" element={<Wallet />} />
              <Route path="chat" element={<Chat />} />
              <Route path="game/:gameId" element={<GamePlay />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
