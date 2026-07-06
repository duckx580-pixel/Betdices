import React, { useState } from "react";
import { Search } from "lucide-react";
import VIPCard from "../components/VIPCard";
import GameRow from "../components/GameRow";
import { betDiceOriginals, newSlots, popularSlots } from "../mock";

export default function Home() {
  const [query, setQuery] = useState("");

  const filter = (games) =>
    query.trim()
      ? games.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()))
      : games;

  return (
    <div className="pt-2">
      <VIPCard />

      {/* Search bar */}
      <div className="mt-5 relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search for Game..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-14 pl-12 pr-4 rounded-2xl bg-[#131c2f] border border-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3583ff]/50 focus:border-[#3583ff]/50 transition-all"
        />
      </div>

      {/* Rows */}
      <div className="mt-6">
        <GameRow title="BetDice Originals" games={filter(betDiceOriginals)} icon="star" accentColor="#3583ff" />
        <GameRow title="New Slots" games={filter(newSlots)} icon="rocket" accentColor="#a855f7" />
        <GameRow title="Popular Slots" games={filter(popularSlots)} icon="flame" accentColor="#f97316" />
      </div>
    </div>
  );
}
