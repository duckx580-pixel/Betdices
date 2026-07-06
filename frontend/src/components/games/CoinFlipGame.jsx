import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useBet } from "../../hooks/useBet";
import { GameShell, BetInput, BalanceLine, ResultBadge } from "./_shared";

export default function CoinFlipGame() {
  const { place, busy, balance } = useBet();
  const [bet, setBet] = useState(1);
  const [side, setSide] = useState("heads");
  const [flipping, setFlipping] = useState(false);
  const [face, setFace] = useState("heads");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const flip = async () => {
    setFlipping(true);
    setResult(null);
    // Animation: rapid random flips
    let flips = 0;
    const anim = setInterval(() => {
      setFace(flips % 2 === 0 ? "heads" : "tails");
      flips++;
    }, 90);

    await new Promise((r) => setTimeout(r, 1200));
    clearInterval(anim);

    const landed = Math.random() < 0.5 ? "heads" : "tails";
    setFace(landed);
    const won = landed === side;
    const res = await place({ game: "coinflip", bet, won, multiplier: 1.94, meta: { side, landed } });
    if (res) {
      const r = { bet, won, payout: won ? bet * 1.94 : 0, multiplier: won ? 1.94 : 0, landed };
      setResult(r);
      setHistory((h) => [{ landed, won }, ...h].slice(0, 12));
    }
    setFlipping(false);
  };

  return (
    <GameShell
      right={
        <>
          <BetInput bet={bet} setBet={setBet} balance={balance.dl} />
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Pick a Side</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setSide("heads")} className={`h-14 rounded-xl font-bold transition-all ${side === "heads" ? "bg-yellow-500 text-slate-900" : "bg-white/5 hover:bg-white/10 text-slate-200"}`}>HEADS</button>
              <button onClick={() => setSide("tails")} className={`h-14 rounded-xl font-bold transition-all ${side === "tails" ? "bg-slate-200 text-slate-900" : "bg-white/5 hover:bg-white/10 text-slate-200"}`}>TAILS</button>
            </div>
          </div>
          <div className="bg-[#0a0f1e] border border-white/5 rounded-lg p-3 text-center">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Potential Win (1.94x)</div>
            <div className="font-black text-xl text-yellow-400 mt-0.5">{(bet * 1.94).toFixed(2)} DL</div>
          </div>
          <button onClick={flip} disabled={flipping || busy} className="w-full h-12 rounded-xl bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 transition-colors font-bold text-slate-900 flex items-center justify-center gap-2">
            {flipping ? <><Loader2 className="w-4 h-4 animate-spin" /> Flipping...</> : "Flip Coin"}
          </button>
          <BalanceLine balance={balance.dl} />
        </>
      }
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-yellow-400 blur-3xl" />
        <div className="absolute bottom-10 right-10 w-40 h-40 rounded-full bg-amber-500 blur-3xl" />
      </div>
      <div className="relative h-full flex flex-col items-center justify-center gap-6 py-10">
        <div style={{ perspective: 800 }}>
          <div className={`w-40 h-40 md:w-48 md:h-48 rounded-full shadow-2xl transition-transform duration-100 ${flipping ? "animate-spin" : ""}`} style={{ background: face === "heads" ? "radial-gradient(circle at 30% 30%, #ffe066, #ffb800 60%, #a06800)" : "radial-gradient(circle at 30% 30%, #e2e8f0, #94a3b8 60%, #475569)" }}>
            <div className="w-full h-full flex items-center justify-center text-5xl md:text-6xl font-black text-slate-900/80">
              {face === "heads" ? "H" : "T"}
            </div>
          </div>
        </div>
        <ResultBadge result={result} />
        <div className="flex gap-1.5 flex-wrap justify-center">
          {history.map((h, i) => (
            <div key={i} className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center ${h.won ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{h.landed === "heads" ? "H" : "T"}</div>
          ))}
        </div>
      </div>
    </GameShell>
  );
}
