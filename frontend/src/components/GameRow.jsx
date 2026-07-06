import React, { useRef } from "react";
import { ChevronLeft, ChevronRight, Star, Rocket, Flame } from "lucide-react";
import GameCard from "./GameCard";

const iconMap = {
  star: Star,
  rocket: Rocket,
  flame: Flame,
};

export default function GameRow({ title, games, icon = "star", accentColor = "#3583ff", onViewAll }) {
  const scrollRef = useRef(null);
  const Icon = iconMap[icon] || Star;

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const amount = 320;
    scrollRef.current.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" style={{ color: accentColor }} fill={icon === "star" ? accentColor : "none"} />
          <h2 className="text-lg md:text-xl font-bold">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onViewAll}
            className="px-3 py-1.5 rounded-lg bg-[#131c2f] hover:bg-[#1a2440] text-sm font-medium border border-white/5 transition-colors"
          >
            View All
          </button>
          <button
            onClick={() => scroll(-1)}
            className="hidden md:flex w-9 h-9 rounded-lg bg-[#131c2f] hover:bg-[#1a2440] items-center justify-center border border-white/5 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll(1)}
            className="hidden md:flex w-9 h-9 rounded-lg bg-[#131c2f] hover:bg-[#1a2440] items-center justify-center border border-white/5 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto hide-scrollbar snap-x snap-mandatory pb-2"
      >
        {games.map((g) => (
          <div key={g.id} className="snap-start">
            <GameCard game={g} />
          </div>
        ))}
      </div>
    </section>
  );
}
