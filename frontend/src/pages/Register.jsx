import React, { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { Dice5, ArrowRight, ShieldCheck, Zap, Trophy } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

export default function Register() {
  const { user, register, loading } = useAuth();
  const [growId, setGrowId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!growId.trim() || growId.trim().length < 3) return toast.error("Invalid GrowID");
    if (!password || password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirmPassword) return toast.error("Passwords do not match");

    setBusy(true);
    try {
      await register(growId.trim().toUpperCase(), password);
      navigate("/", { replace: true });
    } catch (err) {
      const responseData = err?.response?.data;
      const serverMessage = [
        typeof responseData === "string" ? responseData : null,
        responseData?.message,
        responseData?.detail,
        responseData?.msg,
        responseData?.error,
        err?.message,
      ].find((value) => typeof value === "string" && value.trim().length > 0);

      toast.error(serverMessage || "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col md:flex-row">
      <div className="md:flex-1 flex items-center justify-center p-8 md:p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-blue-500 blur-3xl" />
          <div className="absolute bottom-20 right-20 w-72 h-72 rounded-full bg-yellow-500 blur-3xl" />
        </div>
        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-300 flex items-center justify-center shadow-2xl">
              <Dice5 className="w-8 h-8 text-slate-800" strokeWidth={2.5} />
            </div>
            <div className="text-3xl font-extrabold tracking-tight">BetDice</div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black leading-tight">
            The Growtopia Casino, <span className="text-[#3583ff]">reimagined</span>.
          </h1>
          <p className="text-slate-400 mt-4 text-lg">
            Play originals, spin slots and deposit via QRIS, DANA, PayPal or Growtopia locks.
          </p>
          <div className="mt-8 space-y-3">
            <Feature icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />} title="Secure Deposits" desc="QRIS, DANA, PayPal & Growtopia bot trades." />
            <Feature icon={<Zap className="w-5 h-5 text-yellow-400" />} title="Instant Games" desc="Dice, Crash, Mines, Plinko, Blackjack & more." />
            <Feature icon={<Trophy className="w-5 h-5 text-purple-400" />} title="VIP Rewards" desc="Climb from Bronze to Diamond." />
          </div>
        </div>
      </div>

      <div className="md:w-[440px] bg-[#131c2f] border-l border-white/5 flex items-center justify-center p-8 md:p-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl font-extrabold">Create your account</h2>
            <p className="text-slate-400 text-sm mt-1">Choose a GrowID and secure password.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">GrowID</label>
            <input
              type="text"
              value={growId}
              onChange={(e) => setGrowId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="PLAYER123"
              maxLength={18}
              autoFocus
              className="mt-1.5 w-full h-12 px-4 rounded-xl bg-[#0a0f1e] border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#3583ff]/50 font-mono tracking-wide font-bold"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              minLength={6}
              className="mt-1.5 w-full h-12 px-4 rounded-xl bg-[#0a0f1e] border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#3583ff]/50 font-semibold"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              minLength={6}
              className="mt-1.5 w-full h-12 px-4 rounded-xl bg-[#0a0f1e] border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#3583ff]/50 font-semibold"
            />
          </div>

          <button
            type="submit"
            disabled={busy || !growId.trim() || !password || !confirmPassword}
            className="w-full h-12 rounded-xl bg-[#3583ff] hover:bg-[#2872ef] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold text-white flex items-center justify-center gap-2"
          >
            {busy ? "Creating account..." : <>Register <ArrowRight className="w-4 h-4" /></>}
          </button>

          <p className="text-sm text-slate-400 text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-[#5d97ff] hover:text-[#7cabff] font-semibold">
              Sign in
            </Link>
          </p>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            By continuing, you agree to our Terms & Fair Play. 18+ only.
          </p>
        </form>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <div className="font-bold">{title}</div>
        <div className="text-sm text-slate-400">{desc}</div>
      </div>
    </div>
  );
}
