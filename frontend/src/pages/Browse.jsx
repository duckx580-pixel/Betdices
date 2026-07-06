import React, { useState } from "react";
import { Search } from "lucide-react";
import GameCard from "../components/GameCard";
import { betDiceOriginals, newSlots, popularSlots } from "../mock";

const tabs = [
  { id: "all", label: "All Games" },
  { id: "originals", label: "Originals" },
  { id: "slots", label: "Slots" },
  { id: "live", label: "Live Casino" },
];

export default function Browse() {
  const [active, setActive] = useState("all");
  const [query, setQuery] = useState("");

  const allGames = [...betDiceOriginals, ...newSlots, ...popularSlots];
  let list = allGames;
  if (active === "originals") list = betDiceOriginals;
  else if (active === "slots") list = [...newSlots, ...popularSlots];
  else if (active === "live") list = [];

  if (query.trim()) {
    list = list.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()));
  }

  return (
    <div className="pt-2">
      <h1 className="text-2xl md:text-3xl font-extrabold mb-4">Browse Games</h1>

      <div className="relative mb-4">
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search games..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#131c2f] border border-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3583ff]/50"
        />
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              active === t.id
                ? "bg-[#3583ff] text-white shadow-lg shadow-blue-500/25"
                : "bg-[#131c2f] text-slate-300 hover:bg-[#1a2440] border border-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-lg font-medium">No games available in this category yet.</p>
          <p className="text-sm mt-2">Live Casino is coming soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {list.map((g) => (
            <GameCard key={g.id} game={g} size="sm" />
          ))}
        </div>
      )}
    </div>
  );
}
