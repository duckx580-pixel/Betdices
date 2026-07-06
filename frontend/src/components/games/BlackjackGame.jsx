import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useBet } from "../../hooks/useBet";
import { BalanceLine } from "./_shared";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function newCard() {
  return { rank: RANKS[Math.floor(Math.random() * 13)], suit: SUITS[Math.floor(Math.random() * 4)] };
}

function handValue(hand) {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.rank === "A") { total += 11; aces++; }
    else if (["J", "Q", "K"].includes(c.rank)) total += 10;
    else total += parseInt(c.rank, 10);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

export default function BlackjackGame() {
  const { place, busy, balance } = useBet();
  const [bet, setBet] = useState(1);
  const [phase, setPhase] = useState("idle"); // idle | player | dealer | done
  const [player, setPlayer] = useState([]);
  const [dealer, setDealer] = useState([]);
  const [result, setResult] = useState(null);

  const start = () => {
    if (bet > balance.dl) return;
    const p = [newCard(), newCard()];
    const d = [newCard(), newCard()];
    setPlayer(p);
    setDealer(d);
    setResult(null);
    if (handValue(p) === 21) {
      // blackjack
      finish(p, d, "blackjack");
      return;
    }
    setPhase("player");
  };

  const hit = () => {
    const p = [...player, newCard()];
    setPlayer(p);
    const v = handValue(p);
    if (v > 21) {
      finish(p, dealer, "bust");
    } else if (v === 21) {
      stand(p);
    }
  };

  const stand = async (p = player) => {
    setPhase("dealer");
    let d = [...dealer];
    while (handValue(d) < 17) d.push(newCard());
    setDealer(d);
    await new Promise((r) => setTimeout(r, 600));
    const pv = handValue(p);
    const dv = handValue(d);
    let outcome;
    if (dv > 21) outcome = "dealer_bust";
    else if (pv > dv) outcome = "win";
    else if (pv === dv) outcome = "push";
    else outcome = "lose";
    finish(p, d, outcome);
  };

  const finish = async (p, d, outcome) => {
    setPhase("done");
    let won = false, mult = 0;
    if (outcome === "blackjack") { won = true; mult = 2.5; }
    else if (outcome === "win" || outcome === "dealer_bust") { won = true; mult = 2; }
    else if (outcome === "push") { won = true; mult = 1; } // return stake
    setResult({ outcome, mult });
    await place({ game: "blackjack", bet, won, multiplier: mult, meta: { outcome, player_total: handValue(p), dealer_total: handValue(d) } });
  };

  const reset = () => {
    setPhase("idle");
    setPlayer([]);
    setDealer([]);
    setResult(null);
  };

  const pv = handValue(player);
  const dv = handValue(dealer);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-gradient-to-br from-emerald-900 to-slate-900 border border-emerald-500/20 rounded-2xl p-6 md:p-8 min-h-[420px] flex flex-col justify-between">
        <div>
          <div className="text-sm text-slate-300 mb-2">Dealer {phase !== "player" && dealer.length > 0 && `(${dv})`}</div>
          <div className="flex gap-2 flex-wrap">
            {dealer.map((c, i) => (
              <Card key={i} card={i === 1 && phase === "player" ? null : c} />
            ))}
          </div>
        </div>

        {result && (
          <div className="text-center pop-in py-4">
            <div className={`text-3xl font-black ${result.mult > 1 ? "text-emerald-400" : result.mult === 1 ? "text-yellow-400" : "text-red-400"}`}>
              {result.outcome.toUpperCase().replace("_", " ")}
            </div>
            <div className="text-slate-300 mt-1">
              {result.mult > 1 ? `+${(bet * result.mult - bet).toFixed(2)} DL` : result.mult === 1 ? "Push — stake returned" : `-${bet.toFixed(2)} DL`}
            </div>
          </div>
        )}

        <div>
          <div className="text-sm text-slate-300 mb-2">You {player.length > 0 && `(${pv})`}</div>
          <div className="flex gap-2 flex-wrap">
            {player.map((c, i) => <Card key={i} card={c} />)}
          </div>
        </div>
      </div>

      <div className="bg-[#131c2f] border border-white/5 rounded-2xl p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Bet (DL)</label>
          <input type="number" min="0.1" step="0.1" value={bet} onChange={(e) => setBet(parseFloat(e.target.value) || 0)} disabled={phase === "player" || phase === "dealer"} className="mt-1 w-full h-11 px-3 rounded-lg bg-[#0a0f1e] border border-white/10 text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#3583ff]/50 disabled:opacity-50" />
        </div>

        {phase === "idle" || phase === "done" ? (
          <button onClick={phase === "done" ? () => { reset(); start(); } : start} disabled={busy} className="w-full h-12 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 font-bold text-white">
            {phase === "done" ? "Play Again" : "Deal"}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={hit} disabled={phase !== "player"} className="h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 font-bold text-white">Hit</button>
            <button onClick={() => stand()} disabled={phase !== "player" || busy} className="h-12 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 font-bold text-white flex items-center justify-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Stand
            </button>
          </div>
        )}
        <BalanceLine balance={balance.dl} />
      </div>
    </div>
  );
}

function Card({ card }) {
  if (!card) {
    return (
      <div className="w-16 h-24 rounded-lg bg-gradient-to-br from-blue-800 to-blue-950 border border-blue-500/50 shadow-lg flex items-center justify-center">
        <div className="w-10 h-16 rounded border-2 border-blue-400/30" />
      </div>
    );
  }
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <div className="w-16 h-24 rounded-lg bg-white shadow-lg flex flex-col items-center justify-center relative pop-in">
      <div className={`absolute top-1 left-2 font-black text-sm ${red ? "text-red-600" : "text-slate-900"}`}>{card.rank}</div>
      <div className={`text-3xl ${red ? "text-red-600" : "text-slate-900"}`}>{card.suit}</div>
      <div className={`absolute bottom-1 right-2 font-black text-sm rotate-180 ${red ? "text-red-600" : "text-slate-900"}`}>{card.rank}</div>
    </div>
  );
}
