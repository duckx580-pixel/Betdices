import React, { useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { useBet } from "../../hooks/useBet";
import { GameShell, BetInput, BalanceLine } from "./_shared";

const multipliers = [1.5, 2, 3, 5, 10, 50, 100, 1000];

export default function SlideGame() {
  const { place, busy, balance } = useBet();
  const [bet, setBet] = useState(1);
  const [selectedMult, setSelectedMult] = useState(2);
  const [rolling, setRolling] = useState(false);
  const [ballPos, setBallPos] = useState(0);
  const [result, setResult] = useState(null);

  const play = async () => {
    setRolling(true);
    setResult(null);
    const target = Math.random() * 100;
    const winThreshold = 97 / selectedMult;
    let current = 0;
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        current += (target - current) * 0.15;
        setBallPos(current);
        if (Math.abs(target - current) < 0.5) {
          clearInterval(interval);
          setBallPos(target);
          resolve();
        }
      }, 50);
    });
    const won = target <= winThreshold;
    const res = await place({ game: "slide", bet, won, multiplier: selectedMult, meta: { landed: target } });
    if (res) setResult({ landed: target, won, payout: won ? bet * selectedMult : 0 });
    setRolling(false);
  };

  return (
    <GameShell
      right={
        <>
          <BetInput bet={bet} setBet={setBet} balance={balance.dl} />
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Multiplier</div>
            <div className="grid grid-cols-4 gap-1.5">
              {multipliers.map((m) => (
                <button key={m} onClick={() => setSelectedMult(m)} className={`h-10 rounded-lg text-sm font-bold transition-all ${selectedMult === m ? "bg-yellow-500 text-slate-900" : "bg-white/5 hover:bg-white/10 text-slate-300"}`}>{m}x</button>
              ))}
            </div>
          </div>
          <div className="bg-[#0a0f1e] border border-white/5 rounded-lg p-3 text-center">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Potential Win</div>
            <div className="font-black text-xl text-yellow-400 mt-0.5">{(bet * selectedMult).toFixed(2)} DL</div>
          </div>
          <button onClick={play} disabled={rolling || busy} className="w-full h-12 rounded-xl bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 transition-colors font-bold text-slate-900 flex items-center justify-center gap-2">
            {rolling ? <><Loader2 className="w-4 h-4 animate-spin" /> Sliding...</> : <><TrendingUp className="w-4 h-4" /> Slide</>}
          </button>
          <BalanceLine balance={balance.dl} />
        </>
      }
    >
      <div className="flex items-center justify-center h-full">
        <div className="w-full max-w-md space-y-4">
          <div className="flex justify-between text-xs text-slate-400 font-semibold"><span>0</span><span>50</span><span>100</span></div>
          <div className="relative h-8 rounded-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-600 overflow-hidden">
            <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: `${97 / selectedMult}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-2xl border-4 border-slate-900" style={{ left: `calc(${ballPos}% - 20px)` }} />
          </div>
          {result && !rolling && (
            <div className="text-center pop-in">
              <div className={`text-3xl font-black ${result.won ? "text-emerald-400" : "text-red-400"}`}>{result.landed.toFixed(2)}</div>
              <div className={`text-lg font-bold ${result.won ? "text-emerald-400" : "text-red-400"}`}>{result.won ? `+${(result.payout - bet).toFixed(2)} DL` : `-${bet.toFixed(2)} DL`}</div>
            </div>
          )}
          {!result && !rolling && <div className="text-center text-slate-400 text-sm">Land under the marker to win {selectedMult}x</div>}
        </div>
      </div>
    </GameShell>
  );
}
