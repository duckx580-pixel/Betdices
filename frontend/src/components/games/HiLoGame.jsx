import React, { useState } from "react";
import { ArrowUp, ArrowDown, Loader2, RotateCcw } from "lucide-react";
import { useBet } from "../../hooks/useBet";
import { BalanceLine } from "./_shared";

function randCard() {
  return Math.floor(Math.random() * 13) + 1; // 1..13
}

function cardLabel(v) {
  if (v === 1) return "A";
  if (v === 11) return "J";
  if (v === 12) return "Q";
  if (v === 13) return "K";
  return String(v);
}

function odds(current, dir) {
  // dir 'high' means next > current, 'low' means < current, equal = loss
  const total = 13;
  const higher = 13 - current;
  const lower = current - 1;
  const p = dir === "high" ? higher / total : lower / total;
  if (p <= 0) return 0;
  return +(0.97 / p).toFixed(4);
}

export default function HiLoGame() {
  const { place, busy, balance } = useBet();
  const [bet, setBet] = useState(1);
  const [inGame, setInGame] = useState(false);
  const [current, setCurrent] = useState(randCard());
  const [multiplier, setMultiplier] = useState(1);
  const [round, setRound] = useState(0);
  const [flashResult, setFlashResult] = useState(null);

  const start = () => {
    if (bet > balance.dl) return;
    setCurrent(randCard());
    setMultiplier(1);
    setRound(0);
    setInGame(true);
    setFlashResult(null);
  };

  const guess = async (dir) => {
    const next = randCard();
    const won = dir === "high" ? next > current : next < current;
    const stepMult = odds(current, dir);
    if (won && stepMult > 0) {
      const newMult = +(multiplier * stepMult).toFixed(4);
      setMultiplier(newMult);
      setCurrent(next);
      setRound((r) => r + 1);
      setFlashResult({ next, won: true });
    } else {
      setFlashResult({ next, won: false });
      setInGame(false);
      await place({ game: "hilo", bet, won: false, multiplier: 0, meta: { rounds: round } });
    }
  };

  const cashout = async () => {
    if (round === 0) return;
    await place({ game: "hilo", bet, won: true, multiplier, meta: { rounds: round } });
    setInGame(false);
    setFlashResult({ cashed: true });
  };

  const highOdds = odds(current, "high");
  const lowOdds = odds(current, "low");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-gradient-to-br from-purple-900/30 to-slate-900 border border-white/5 rounded-2xl p-6 md:p-8 min-h-[420px] flex flex-col items-center justify-center gap-6">
        <div className="text-center">
          <div className="text-slate-400 text-sm mb-2">Current Card</div>
          <div className="w-32 h-44 rounded-2xl bg-white shadow-2xl flex flex-col items-center justify-center relative">
            <div className="absolute top-2 left-3 text-red-600 font-black text-2xl">{cardLabel(current)}</div>
            <div className="text-6xl font-black text-red-600">{cardLabel(current)}</div>
            <div className="absolute bottom-2 right-3 text-red-600 font-black text-2xl rotate-180">{cardLabel(current)}</div>
          </div>
        </div>

        {flashResult && (
          <div className="pop-in text-center">
            {flashResult.cashed ? (
              <div className="text-emerald-400 font-black text-xl">Cashed out {(bet * multiplier).toFixed(2)} DL</div>
            ) : flashResult.won ? (
              <div className="text-emerald-400 font-bold">Correct! Next: {cardLabel(flashResult.next)}</div>
            ) : (
              <div className="text-red-400 font-bold">Wrong. Next was: {cardLabel(flashResult.next)}</div>
            )}
          </div>
        )}

        {inGame && (
          <div className="flex gap-3">
            <button onClick={() => guess("high")} disabled={highOdds === 0} className="px-6 h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 font-bold text-white flex items-center gap-2">
              <ArrowUp className="w-5 h-5" /> Higher <span className="opacity-80 text-sm">({highOdds.toFixed(2)}x)</span>
            </button>
            <button onClick={() => guess("low")} disabled={lowOdds === 0} className="px-6 h-14 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-30 font-bold text-white flex items-center gap-2">
              <ArrowDown className="w-5 h-5" /> Lower <span className="opacity-80 text-sm">({lowOdds.toFixed(2)}x)</span>
            </button>
          </div>
        )}
      </div>

      <div className="bg-[#131c2f] border border-white/5 rounded-2xl p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Bet (DL)</label>
          <input type="number" min="0.1" step="0.1" value={bet} onChange={(e) => setBet(parseFloat(e.target.value) || 0)} disabled={inGame} className="mt-1 w-full h-11 px-3 rounded-lg bg-[#0a0f1e] border border-white/10 text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#3583ff]/50 disabled:opacity-50" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#0a0f1e] border border-white/5 rounded-lg p-3 text-center">
            <div className="text-[10px] uppercase text-slate-500 font-semibold">Multiplier</div>
            <div className="font-black text-lg text-purple-400">{multiplier.toFixed(2)}x</div>
          </div>
          <div className="bg-[#0a0f1e] border border-white/5 rounded-lg p-3 text-center">
            <div className="text-[10px] uppercase text-slate-500 font-semibold">Round</div>
            <div className="font-black text-lg text-white">{round}</div>
          </div>
        </div>
        {!inGame ? (
          <button onClick={start} disabled={busy} className="w-full h-12 rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 font-bold text-white flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" /> Start Round
          </button>
        ) : (
          <button onClick={cashout} disabled={round === 0 || busy} className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 font-bold text-white flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Cash Out {(bet * multiplier).toFixed(2)} DL
          </button>
        )}
        <BalanceLine balance={balance.dl} />
      </div>
    </div>
  );
}
