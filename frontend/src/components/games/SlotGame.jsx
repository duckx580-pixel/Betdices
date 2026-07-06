import React, { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { useBet } from "../../hooks/useBet";
import { GameShell, BetInput, BalanceLine } from "./_shared";

const SYMBOLS = ["🍒", "🍋", "🍇", "💎", "⭐", "🔔", "7️⃣"];
const PAYOUTS = { "🍒": 3, "🍋": 4, "🍇": 5, "💎": 10, "⭐": 20, "🔔": 50, "7️⃣": 100 };

function spinReel() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

export default function SlotGame({ game }) {
  const { place, busy, balance } = useBet();
  const [bet, setBet] = useState(1);
  const [reels, setReels] = useState(["?", "?", "?"]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);

  const spin = async () => {
    setSpinning(true);
    setResult(null);

    // Reel animation: cycle symbols
    const iterations = 20;
    for (let i = 0; i < iterations; i++) {
      setReels([spinReel(), spinReel(), spinReel()]);
      await new Promise((r) => setTimeout(r, 60));
    }
    const final = [spinReel(), spinReel(), spinReel()];
    setReels(final);

    // Determine payout
    let mult = 0;
    if (final[0] === final[1] && final[1] === final[2]) {
      mult = PAYOUTS[final[0]] || 0;
    } else if (final[0] === final[1] || final[1] === final[2] || final[0] === final[2]) {
      mult = 1.5; // any pair
    }
    const won = mult > 1;
    await place({ game: `slot:${game.id}`, bet, won, multiplier: mult, meta: { reels: final } });
    setResult({ won, mult });
    setSpinning(false);
  };

  return (
    <GameShell
      right={
        <>
          <BetInput bet={bet} setBet={setBet} balance={balance.dl} />
          <div className="bg-[#0a0f1e] border border-white/5 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Paytable</div>
            <div className="grid grid-cols-2 gap-1 text-xs mt-2">
              {Object.entries(PAYOUTS).map(([s, m]) => (
                <div key={s} className="flex items-center justify-between">
                  <span className="text-lg">{s}{s}{s}</span>
                  <span className="font-bold text-yellow-400">{m}x</span>
                </div>
              ))}
              <div className="flex items-center justify-between col-span-2">
                <span>Any pair</span>
                <span className="font-bold text-slate-300">1.5x</span>
              </div>
            </div>
          </div>
          <button onClick={spin} disabled={spinning || busy} className="w-full h-12 rounded-xl bg-pink-500 hover:bg-pink-600 disabled:opacity-50 font-bold text-white flex items-center justify-center gap-2">
            {spinning ? <><Loader2 className="w-4 h-4 animate-spin" /> Spinning...</> : <><Play className="w-4 h-4" fill="currentColor" /> Spin</>}
          </button>
          <BalanceLine balance={balance.dl} />
        </>
      }
    >
      <div className={`absolute inset-0 opacity-15 bg-gradient-to-br ${game.bg || "from-pink-500 to-purple-700"}`} />
      <div className="relative flex flex-col items-center justify-center h-full gap-6 py-10">
        <div className="flex gap-3 bg-black/40 rounded-2xl p-4 border-2 border-yellow-500/50">
          {reels.map((r, i) => (
            <div key={i} className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-white flex items-center justify-center text-5xl md:text-6xl shadow-inner">
              {r}
            </div>
          ))}
        </div>
        {result && !spinning && (
          <div className="pop-in text-center">
            <div className={`text-3xl font-black ${result.won ? "text-emerald-400" : "text-red-400"}`}>
              {result.won ? `+${(bet * result.mult - bet).toFixed(2)} DL` : `-${bet.toFixed(2)} DL`}
            </div>
            {result.won && <div className="text-yellow-400 font-bold">{result.mult}x!</div>}
          </div>
        )}
      </div>
    </GameShell>
  );
}
