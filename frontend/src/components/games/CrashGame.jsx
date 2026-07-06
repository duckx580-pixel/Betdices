import React, { useState, useEffect, useRef } from "react";
import { Rocket, Loader2 } from "lucide-react";
import { useBet } from "../../hooks/useBet";
import { GameShell, BetInput, BalanceLine } from "./_shared";

function genCrashPoint() {
  // Provably-fair-like distribution: house edge ~3%
  const r = Math.random();
  if (r < 0.03) return 1.0; // instant crash 3%
  return +(0.97 / (1 - r)).toFixed(2);
}

export default function CrashGame() {
  const { place, busy, balance } = useBet();
  const [bet, setBet] = useState(1);
  const [autoCashout, setAutoCashout] = useState(2);
  const [phase, setPhase] = useState("idle"); // idle | running | crashed
  const [multiplier, setMultiplier] = useState(1);
  const [crashPoint, setCrashPoint] = useState(null);
  const [cashedAt, setCashedAt] = useState(null);
  const [history, setHistory] = useState([]);
  const rafRef = useRef();
  const startRef = useRef(0);

  const start = () => {
    if (bet > balance.dl) return;
    const cp = genCrashPoint();
    setCrashPoint(cp);
    setCashedAt(null);
    setMultiplier(1);
    setPhase("running");
    startRef.current = performance.now();
    tick(cp);
  };

  const tick = (cp) => {
    const step = () => {
      const elapsed = (performance.now() - startRef.current) / 1000;
      // multiplier grows exponentially
      const m = +(Math.pow(Math.E, 0.10 * elapsed)).toFixed(2);
      setMultiplier(m);
      if (m >= cp) {
        setPhase("crashed");
        // record loss unless already cashed
        finishRound(false, cp, cp);
        return;
      }
      // auto cashout
      if (autoCashout && m >= autoCashout) {
        cashout(cp, autoCashout);
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const cashout = async (cp = crashPoint, at = multiplier) => {
    if (phase !== "running") return;
    cancelAnimationFrame(rafRef.current);
    setPhase("crashed");
    setCashedAt(at);
    await finishRound(true, at, cp);
  };

  const finishRound = async (won, at, cp) => {
    await place({ game: "crash", bet, won, multiplier: won ? at : 0, meta: { crash_point: cp, cashed_at: won ? at : null } });
    setHistory((h) => [{ cp, won, at: won ? at : null }, ...h].slice(0, 15));
  };

  const reset = () => {
    setPhase("idle");
    setMultiplier(1);
    setCrashPoint(null);
    setCashedAt(null);
  };

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const color = phase === "crashed" ? (cashedAt ? "text-emerald-400" : "text-red-400") : "text-white";

  return (
    <GameShell
      right={
        <>
          <BetInput bet={bet} setBet={setBet} balance={balance.dl} />
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Auto Cashout (x)</label>
            <input
              type="number"
              min="1.01"
              step="0.01"
              value={autoCashout}
              onChange={(e) => setAutoCashout(parseFloat(e.target.value) || 0)}
              disabled={phase === "running"}
              className="mt-1 w-full h-11 px-3 rounded-lg bg-[#0a0f1e] border border-white/10 text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#3583ff]/50"
            />
          </div>
          {phase === "idle" || phase === "crashed" ? (
            <>
              <button onClick={phase === "crashed" ? reset : start} disabled={busy} className="w-full h-12 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 font-bold text-white flex items-center justify-center gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                {phase === "crashed" ? "Play Again" : "Launch"}
              </button>
            </>
          ) : (
            <button onClick={() => cashout()} className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-bold text-white glow-pulse">
              Cash Out {(bet * multiplier).toFixed(2)} DL
            </button>
          )}
          <BalanceLine balance={balance.dl} />
        </>
      }
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-cyan-400 blur-3xl" />
      </div>
      <div className="relative flex flex-col items-center justify-center h-full py-10">
        <div className={`text-7xl md:text-8xl font-black tracking-tight ${color}`}>
          {multiplier.toFixed(2)}x
        </div>
        <div className="mt-4 h-6">
          {phase === "crashed" && !cashedAt && <div className="text-red-400 font-bold text-lg">CRASHED @ {crashPoint?.toFixed(2)}x</div>}
          {phase === "crashed" && cashedAt && <div className="text-emerald-400 font-bold text-lg">Cashed out @ {cashedAt.toFixed(2)}x — +{(bet * cashedAt - bet).toFixed(2)} DL</div>}
          {phase === "running" && <div className="text-slate-400">Rising... cash out anytime</div>}
          {phase === "idle" && <div className="text-slate-500">Place your bet & launch</div>}
        </div>

        {/* Rocket icon animation */}
        <div className="mt-6 relative w-64 h-16">
          <Rocket className={`w-10 h-10 text-cyan-400 absolute bottom-0 transition-all duration-100 ${phase === "running" ? "animate-bounce" : ""}`} style={{ left: `${Math.min(90, (multiplier - 1) * 20)}%` }} />
        </div>

        <div className="mt-6 flex gap-1.5 flex-wrap justify-center max-w-md">
          {history.map((h, i) => (
            <div key={i} className={`px-2 py-1 rounded-md text-xs font-bold ${h.won ? "bg-emerald-500/20 text-emerald-400" : h.cp < 2 ? "bg-red-500/20 text-red-400" : "bg-slate-500/20 text-slate-300"}`}>
              {h.cp.toFixed(2)}x
            </div>
          ))}
        </div>
      </div>
    </GameShell>
  );
}
