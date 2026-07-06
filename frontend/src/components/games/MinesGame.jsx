import React, { useState } from "react";
import { Bomb, Gem, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBet } from "../../hooks/useBet";
import { GameShell, BetInput, BalanceLine } from "./_shared";

const GRID = 25;

function generateMines(count) {
  const set = new Set();
  while (set.size < count) set.add(Math.floor(Math.random() * GRID));
  return set;
}

function multForRevealed(mines, revealed) {
  // house edge ~1%, standard mines multiplier calc
  let m = 1;
  for (let i = 0; i < revealed; i++) {
    m *= (GRID - i) / (GRID - mines - i);
  }
  return +(m * 0.99).toFixed(4);
}

export default function MinesGame() {
  const { place, busy, balance } = useBet();
  const [bet, setBet] = useState(1);
  const [numMines, setNumMines] = useState(3);
  const [inGame, setInGame] = useState(false);
  const [minesSet, setMinesSet] = useState(new Set());
  const [revealed, setRevealed] = useState([]); // indexes
  const [exploded, setExploded] = useState(false);
  const [current, setCurrent] = useState(null);

  const currentMult = inGame ? multForRevealed(numMines, revealed.length) : 1;
  const currentPayout = +(bet * currentMult).toFixed(2);

  const startGame = async () => {
    if (bet > balance.dl) return toast.error("Insufficient balance");
    setMinesSet(generateMines(numMines));
    setRevealed([]);
    setExploded(false);
    setCurrent(null);
    setInGame(true);
  };

  const revealTile = async (idx) => {
    if (!inGame || revealed.includes(idx) || exploded) return;
    if (minesSet.has(idx)) {
      setExploded(true);
      // Show all mines
      setRevealed((r) => [...r, idx]);
      // Lose bet on backend
      const res = await place({ game: "mines", bet, won: false, multiplier: 0, meta: { mines: numMines, hit_mine: true, revealed_count: revealed.length } });
      if (res) setCurrent({ won: false });
      setInGame(false);
      return;
    }
    setRevealed((r) => [...r, idx]);
  };

  const cashout = async () => {
    if (!inGame || revealed.length === 0) return;
    const mult = multForRevealed(numMines, revealed.length);
    const res = await place({ game: "mines", bet, won: true, multiplier: mult, meta: { mines: numMines, revealed_count: revealed.length } });
    if (res) {
      setCurrent({ won: true, mult });
      setInGame(false);
    }
  };

  return (
    <GameShell
      right={
        <>
          <BetInput bet={bet} setBet={setBet} balance={balance.dl} />
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex justify-between">
              <span>Mines</span><span className="text-orange-400 text-lg font-black normal-case">{numMines}</span>
            </div>
            <input type="range" min="1" max="24" value={numMines} onChange={(e) => setNumMines(parseInt(e.target.value, 10))} disabled={inGame} className="mt-2 w-full accent-orange-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Multiplier" value={`${currentMult.toFixed(2)}x`} />
            <Stat label="Payout" value={`${currentPayout} DL`} />
          </div>
          {!inGame ? (
            <button onClick={startGame} disabled={busy} className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 font-bold text-white">Start Game</button>
          ) : (
            <button onClick={cashout} disabled={revealed.length === 0 || busy} className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 font-bold text-white flex items-center justify-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Cash Out {revealed.length > 0 && `${currentPayout} DL`}
            </button>
          )}
          <BalanceLine balance={balance.dl} />
        </>
      }
    >
      <div className="grid grid-cols-5 gap-2 max-w-md mx-auto">
        {Array.from({ length: GRID }).map((_, idx) => {
          const isRevealed = revealed.includes(idx);
          const isMine = minesSet.has(idx);
          const showBomb = exploded && isMine;
          return (
            <button
              key={idx}
              onClick={() => revealTile(idx)}
              disabled={!inGame || isRevealed}
              className={`aspect-square rounded-xl font-black text-xl transition-all no-select ${
                isRevealed && !isMine
                  ? "bg-emerald-500/25 border-2 border-emerald-500 text-emerald-300 scale-95"
                  : showBomb
                  ? "bg-red-500/30 border-2 border-red-500 text-red-300"
                  : inGame
                  ? "bg-[#0a0f1e] border-2 border-white/10 hover:border-[#3583ff] hover:bg-[#131c2f] cursor-pointer"
                  : "bg-[#0a0f1e] border-2 border-white/5"
              }`}
            >
              {isRevealed && !isMine ? <Gem className="w-6 h-6 mx-auto" /> : showBomb ? <Bomb className="w-6 h-6 mx-auto" /> : ""}
            </button>
          );
        })}
      </div>
      {current && (
        <div className="mt-4 text-center pop-in">
          <div className={`text-2xl font-black ${current.won ? "text-emerald-400" : "text-red-400"}`}>
            {current.won ? `Cashed out ${(bet * current.mult).toFixed(2)} DL` : "BOOM! Bust"}
          </div>
        </div>
      )}
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
