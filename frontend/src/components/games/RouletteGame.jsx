import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useBet } from "../../hooks/useBet";
import { GameShell, BetInput, BalanceLine } from "./_shared";

const NUMBERS = Array.from({ length: 37 }, (_, i) => i); // 0..36
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function color(n) {
  if (n === 0) return "green";
  return RED.has(n) ? "red" : "black";
}

export default function RouletteGame() {
  const { place, busy, balance } = useBet();
  const [bet, setBet] = useState(1);
  const [choice, setChoice] = useState({ type: "color", value: "red" });
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const spin = async () => {
    if (bet > balance.dl) return;
    setSpinning(true);
    await new Promise((r) => setTimeout(r, 1200));
    const landed = Math.floor(Math.random() * 37);
    const landedColor = color(landed);
    let won = false;
    let mult = 0;
    if (choice.type === "color") {
      if (choice.value === landedColor) { won = true; mult = landed === 0 ? 0 : 1.94; }
    } else if (choice.type === "parity") {
      if (landed !== 0 && (landed % 2 === 0) === (choice.value === "even")) { won = true; mult = 1.94; }
    } else if (choice.type === "range") {
      if ((choice.value === "low" && landed >= 1 && landed <= 18) || (choice.value === "high" && landed >= 19 && landed <= 36)) { won = true; mult = 1.94; }
    } else if (choice.type === "number") {
      if (landed === choice.value) { won = true; mult = 35; }
    }
    await place({ game: "roulette", bet, won, multiplier: mult, meta: { landed, choice } });
    setResult({ landed, landedColor, won, mult });
    setHistory((h) => [{ landed, landedColor }, ...h].slice(0, 15));
    setSpinning(false);
  };

  return (
    <GameShell
      right={
        <>
          <BetInput bet={bet} setBet={setBet} balance={balance.dl} />
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Bet On</div>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                <PickBtn active={choice.type === "color" && choice.value === "red"} onClick={() => setChoice({ type: "color", value: "red" })} className="bg-red-600 hover:bg-red-700">Red 1.94x</PickBtn>
                <PickBtn active={choice.type === "color" && choice.value === "black"} onClick={() => setChoice({ type: "color", value: "black" })} className="bg-slate-800 hover:bg-slate-700">Black 1.94x</PickBtn>
                <PickBtn active={choice.type === "color" && choice.value === "green"} onClick={() => setChoice({ type: "color", value: "green" })} className="bg-emerald-600 hover:bg-emerald-700">Green 35x</PickBtn>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <PickBtn active={choice.type === "parity" && choice.value === "even"} onClick={() => setChoice({ type: "parity", value: "even" })} className="bg-blue-600 hover:bg-blue-700">Even 1.94x</PickBtn>
                <PickBtn active={choice.type === "parity" && choice.value === "odd"} onClick={() => setChoice({ type: "parity", value: "odd" })} className="bg-blue-600 hover:bg-blue-700">Odd 1.94x</PickBtn>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <PickBtn active={choice.type === "range" && choice.value === "low"} onClick={() => setChoice({ type: "range", value: "low" })} className="bg-indigo-600 hover:bg-indigo-700">1-18 1.94x</PickBtn>
                <PickBtn active={choice.type === "range" && choice.value === "high"} onClick={() => setChoice({ type: "range", value: "high" })} className="bg-indigo-600 hover:bg-indigo-700">19-36 1.94x</PickBtn>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Single Number (35x)</div>
                <input type="number" min="0" max="36" placeholder="0-36" value={choice.type === "number" ? choice.value : ""} onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 36) setChoice({ type: "number", value: v }); }} className="w-full h-10 px-3 rounded-lg bg-[#0a0f1e] border border-white/10 text-white font-bold text-center focus:outline-none focus:ring-2 focus:ring-red-500/50" />
              </div>
            </div>
          </div>
          <button onClick={spin} disabled={spinning || busy} className="w-full h-12 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 font-bold text-white flex items-center justify-center gap-2">
            {spinning ? <><Loader2 className="w-4 h-4 animate-spin" /> Spinning...</> : "Spin Wheel"}
          </button>
          <BalanceLine balance={balance.dl} />
        </>
      }
    >
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className={`w-48 h-48 rounded-full border-8 border-yellow-500 shadow-2xl flex items-center justify-center relative ${spinning ? "animate-spin" : ""}`} style={{ background: "conic-gradient(from 0deg, #dc2626 0deg 30deg, #0f172a 30deg 60deg, #dc2626 60deg 90deg, #0f172a 90deg 120deg, #dc2626 120deg 150deg, #0f172a 150deg 180deg, #dc2626 180deg 210deg, #0f172a 210deg 240deg, #dc2626 240deg 270deg, #0f172a 270deg 300deg, #dc2626 300deg 330deg, #0f172a 330deg 360deg)" }}>
          <div className="w-24 h-24 rounded-full bg-[#0a0f1e] flex items-center justify-center border-4 border-yellow-500">
            {result && !spinning ? (
              <div className={`text-4xl font-black ${result.landedColor === "red" ? "text-red-500" : result.landedColor === "green" ? "text-emerald-500" : "text-white"}`}>
                {result.landed}
              </div>
            ) : (
              <div className="text-2xl text-slate-500">?</div>
            )}
          </div>
        </div>
        {result && !spinning && (
          <div className="pop-in text-center">
            <div className={`text-2xl font-black ${result.won ? "text-emerald-400" : "text-red-400"}`}>
              {result.won ? `WIN +${(bet * result.mult - bet).toFixed(2)} DL` : `-${bet.toFixed(2)} DL`}
            </div>
            <div className="text-slate-400 text-sm">Landed on {result.landed} ({result.landedColor})</div>
          </div>
        )}
        <div className="flex gap-1 flex-wrap justify-center max-w-md">
          {history.map((h, i) => (
            <div key={i} className={`w-8 h-8 rounded-md text-xs font-bold flex items-center justify-center ${h.landedColor === "red" ? "bg-red-600 text-white" : h.landedColor === "green" ? "bg-emerald-600 text-white" : "bg-slate-800 text-white"}`}>{h.landed}</div>
          ))}
        </div>
      </div>
    </GameShell>
  );
}

function PickBtn({ active, onClick, className, children }) {
  return (
    <button onClick={onClick} className={`h-10 rounded-lg text-xs font-bold text-white transition-all ${active ? `ring-2 ring-white ${className}` : className + " opacity-70 hover:opacity-100"}`}>
      {children}
    </button>
  );
}
