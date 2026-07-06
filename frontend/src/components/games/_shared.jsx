import React from "react";

export function GameShell({ children, right }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-[#131c2f] border border-white/5 rounded-2xl p-4 md:p-6 min-h-[420px] relative overflow-hidden">
        {children}
      </div>
      <div className="bg-[#131c2f] border border-white/5 rounded-2xl p-5 space-y-4">{right}</div>
    </div>
  );
}

export function BetInput({ bet, setBet, balance, max }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Bet Amount (DL)</label>
      <input
        type="number"
        min="0.1"
        step="0.1"
        value={bet}
        onChange={(e) => setBet(parseFloat(e.target.value) || 0)}
        className="mt-1 w-full h-11 px-3 rounded-lg bg-[#0a0f1e] border border-white/10 text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#3583ff]/50"
      />
      <div className="flex gap-1.5 mt-2">
        <button onClick={() => setBet((b) => +(Math.max(0.1, b / 2)).toFixed(2))} className="flex-1 h-8 rounded-md bg-white/5 hover:bg-white/10 text-xs font-semibold">1/2</button>
        <button onClick={() => setBet((b) => +(b * 2).toFixed(2))} className="flex-1 h-8 rounded-md bg-white/5 hover:bg-white/10 text-xs font-semibold">2x</button>
        <button onClick={() => setBet(Math.min(balance || 0, max || balance || 0))} className="flex-1 h-8 rounded-md bg-white/5 hover:bg-white/10 text-xs font-semibold">Max</button>
      </div>
    </div>
  );
}

export function BalanceLine({ balance }) {
  return (
    <div className="text-xs text-center text-slate-500">
      Balance: <span className="font-bold text-white">{(balance || 0).toFixed(2)} DL</span>
    </div>
  );
}

export function ResultBadge({ result }) {
  if (!result) return null;
  const win = result.won;
  return (
    <div className="pop-in text-center">
      <div className={`text-2xl md:text-3xl font-black ${win ? "text-emerald-400" : "text-red-400"}`}>
        {win ? `+${(result.payout - result.bet).toFixed(2)} DL` : `-${result.bet.toFixed(2)} DL`}
      </div>
      {result.multiplier && <div className="text-slate-400 text-sm">Multiplier: {result.multiplier.toFixed(2)}x</div>}
    </div>
  );
}
