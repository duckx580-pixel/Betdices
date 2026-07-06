import React, { useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useBet } from "../../hooks/useBet";
import { GameShell, BetInput, BalanceLine } from "./_shared";

const ROWS = 12;
const MULTIPLIERS = {
  low: [5.6, 2.1, 1.1, 1.0, 0.5, 0.3, 0.5, 1.0, 1.1, 2.1, 5.6],
  medium: [10, 3, 1.4, 1.1, 0.7, 0.4, 0.7, 1.1, 1.4, 3, 10],
  high: [24, 5, 2, 1.4, 0.4, 0.2, 0.4, 1.4, 2, 5, 24],
};

export default function PlinkoGame() {
  const { place, busy, balance } = useBet();
  const [bet, setBet] = useState(1);
  const [risk, setRisk] = useState("medium");
  const [drops, setDrops] = useState([]); // {id, bucket}
  const [dropping, setDropping] = useState(false);
  const nextId = useRef(0);

  const drop = async () => {
    if (bet > balance.dl) return;
    setDropping(true);

    // Simulate binary path through 11 rows -> bucket 0..11
    let bucket = 0;
    for (let i = 0; i < ROWS - 1; i++) {
      if (Math.random() < 0.5) bucket++;
    }
    // bucket 0..10 = 11 buckets, matches multipliers array (length 11)
    const mult = MULTIPLIERS[risk][bucket];
    const won = mult > 1;
    const id = nextId.current++;
    setDrops((d) => [...d, { id, bucket, mult, animating: true }]);

    // wait for animation
    await new Promise((r) => setTimeout(r, 1400));

    await place({ game: "plinko", bet, won, multiplier: mult, meta: { risk, bucket } });
    setDrops((d) => d.map((x) => (x.id === id ? { ...x, animating: false } : x)));
    setDropping(false);
  };

  const mults = MULTIPLIERS[risk];

  return (
    <GameShell
      right={
        <>
          <BetInput bet={bet} setBet={setBet} balance={balance.dl} />
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Risk</div>
            <div className="grid grid-cols-3 gap-1.5">
              {["low", "medium", "high"].map((r) => (
                <button key={r} onClick={() => setRisk(r)} className={`h-10 rounded-lg text-sm font-bold capitalize transition-all ${risk === r ? "bg-pink-500 text-white" : "bg-white/5 hover:bg-white/10 text-slate-300"}`}>{r}</button>
              ))}
            </div>
          </div>
          <button onClick={drop} disabled={dropping || busy} className="w-full h-12 rounded-xl bg-pink-500 hover:bg-pink-600 disabled:opacity-50 font-bold text-white flex items-center justify-center gap-2">
            {dropping ? <><Loader2 className="w-4 h-4 animate-spin" /> Dropping...</> : "Drop Ball"}
          </button>
          <BalanceLine balance={balance.dl} />
        </>
      }
    >
      <div className="flex flex-col items-center h-full">
        {/* Peg board */}
        <div className="relative py-4" style={{ width: 320, height: 300 }}>
          {Array.from({ length: ROWS - 1 }).map((_, row) => (
            <div key={row} className="absolute left-1/2 -translate-x-1/2" style={{ top: row * 24 }}>
              {Array.from({ length: row + 2 }).map((_, i) => (
                <span key={i} className="inline-block w-1.5 h-1.5 rounded-full bg-white/40" style={{ margin: "0 8px" }} />
              ))}
            </div>
          ))}
          {/* Balls */}
          {drops.map((d) => (
            <PlinkoBall key={d.id} bucket={d.bucket} animating={d.animating} />
          ))}
        </div>
        {/* Multiplier buckets */}
        <div className="flex gap-1 mt-2" style={{ width: 320 }}>
          {mults.map((m, i) => (
            <div key={i} className={`flex-1 h-8 rounded-md text-[10px] font-black flex items-center justify-center ${m >= 2 ? "bg-emerald-500 text-white" : m >= 1 ? "bg-yellow-500 text-slate-900" : "bg-slate-600 text-slate-200"}`}>
              {m}x
            </div>
          ))}
        </div>
      </div>
    </GameShell>
  );
}

function PlinkoBall({ bucket, animating }) {
  // bucket 0..10, board is 320px wide -> bucket width ~29px
  const x = 4 + bucket * 28.5;
  return (
    <div
      className="absolute w-3 h-3 rounded-full bg-white shadow-lg"
      style={{
        left: 158,
        top: 0,
        transition: "all 1.2s cubic-bezier(0.4, 1, 0.6, 1)",
        transform: animating ? `translate(${x - 158}px, 290px)` : `translate(${x - 158}px, 290px)`,
      }}
    />
  );
}
