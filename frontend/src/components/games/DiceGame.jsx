import React, { useState } from "react";
import { Dice5, Loader2 } from "lucide-react";
import { useBet } from "../../hooks/useBet";
import { GameShell, BetInput, BalanceLine } from "./_shared";

export default function DiceGame() {
  const { place, busy, balance } = useBet();
  const [bet, setBet] = useState(1);
  const [target, setTarget] = useState(50);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const multiplier = target > 0 ? +(97 / target).toFixed(4) : 0;

  const roll = async () => {
    if (target < 2 || target > 98) return;
    setRolling(true);
    setResult(null);
    await new Promise((r) => setTimeout(r, 800));
    const rolled = +(Math.random() * 100).toFixed(2);
    const won = rolled < target;
    const res = await place({ game: "dice", bet, won, multiplier, meta: { rolled, target } });
    if (res) {
      setResult({ roll: rolled, won, payout: won ? bet * multiplier : 0 });
      setHistory((h) => [{ roll: rolled, won }, ...h].slice(0, 12));
    }
    setRolling(false);
  };

  return (
    <GameShell
      right={
        <>
          <BetInput bet={bet} setBet={setBet} balance={balance.dl} />
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wide">
              <span>Roll Under</span>
              <span className="text-emerald-400 text-lg font-black normal-case">{target}</span>
            </div>
            <input type="range" min="2" max="98" value={target} onChange={(e) => setTarget(parseInt(e.target.value, 10))} className="mt-2 w-full accent-emerald-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Multiplier" value={`${multiplier}x`} />
            <Stat label="Win Chance" value={`${target}%`} />
          </div>
          <button onClick={roll} disabled={rolling || busy} className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 transition-colors font-bold text-white flex items-center justify-center gap-2">
            {rolling ? <><Loader2 className="w-4 h-4 animate-spin" /> Rolling...</> : <><Dice5 className="w-4 h-4" /> Roll Dice</>}
          </button>
          <BalanceLine balance={balance.dl} />
        </>
      }
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-emerald-400 blur-3xl" />
      </div>
      <div className="relative flex flex-col items-center justify-center h-full gap-4 py-8">
        <div className={rolling ? "dice-rolling" : ""}>
          <div className="w-40 h-40 rounded-3xl bg-white shadow-2xl flex items-center justify-center">
            <div className="text-6xl font-black text-slate-900">
              {rolling ? "..." : result ? result.roll.toFixed(2) : "?"}
            </div>
          </div>
        </div>
        {result && !rolling && (
          <div className="text-center pop-in">
            <div className={`text-2xl font-extrabold ${result.won ? "text-emerald-400" : "text-red-400"}`}>
              {result.won ? `+${(result.payout - bet).toFixed(2)} DL` : `-${bet.toFixed(2)} DL`}
            </div>
            <div className="text-slate-400 text-sm">
              {result.won ? `Rolled under ${target} — WIN` : `Rolled ${result.roll.toFixed(2)} — LOSS`}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 justify-center w-full max-w-md">
          {history.map((h, i) => (
            <div key={i} className={`px-2 py-1 rounded-md text-xs font-bold ${h.won ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{h.roll.toFixed(2)}</div>
          ))}
        </div>
      </div>
    </GameShell>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-[#0a0f1e] border border-white/5 rounded-lg p-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
      <div className="font-black text-lg text-white mt-0.5">{value}</div>
    </div>
  );
}
