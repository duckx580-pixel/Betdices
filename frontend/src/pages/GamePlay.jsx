import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import DiceGame from "../components/games/DiceGame";
import SlideGame from "../components/games/SlideGame";
import CoinFlipGame from "../components/games/CoinFlipGame";
import MinesGame from "../components/games/MinesGame";
import CrashGame from "../components/games/CrashGame";
import PlinkoGame from "../components/games/PlinkoGame";
import HiLoGame from "../components/games/HiLoGame";
import RouletteGame from "../components/games/RouletteGame";
import BlackjackGame from "../components/games/BlackjackGame";
import SlotGame from "../components/games/SlotGame";
import { betDiceOriginals, newSlots, popularSlots } from "../mock";

const GAMES = {
  dice: DiceGame,
  slide: SlideGame,
  coinflip: CoinFlipGame,
  mines: MinesGame,
  crash: CrashGame,
  plinko: PlinkoGame,
  hilo: HiLoGame,
  roulette: RouletteGame,
  blackjack: BlackjackGame,
};

export default function GamePlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const allGames = [...betDiceOriginals, ...newSlots, ...popularSlots];
  const game = allGames.find((g) => g.id === gameId);

  if (!game) {
    return (
      <div className="pt-8 text-center">
        <p className="text-slate-400">Game not found.</p>
        <button onClick={() => navigate("/")} className="mt-4 text-[#3583ff]">Back to home</button>
      </div>
    );
  }

  const Comp = GAMES[gameId] || SlotGame;

  return (
    <div className="pt-2">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-extrabold">{game.name}</h1>
        <p className="text-slate-400 text-sm">{game.category || game.provider}</p>
      </div>
      <Comp game={game} />
    </div>
  );
}
