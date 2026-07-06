import React from "react";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";

export default function GameCard({ game, size = "md" }) {
  const navigate = useNavigate();
  const sizeClasses = {
    sm: "w-32 h-32 md:w-36 md:h-36",
    md: "w-40 h-40 md:w-48 md:h-48",
    lg: "w-48 h-48 md:w-56 md:h-56",
  };

  return (
    <button
      onClick={() => navigate(`/game/${game.id}`)}
      className={`game-card relative shrink-0 ${sizeClasses[size]} rounded-2xl overflow-hidden group cursor-pointer bg-gradient-to-br ${game.bg}`}
    >
      {/* Decorative pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-4 right-4 w-16 h-16 rounded-full bg-white/20 blur-xl" />
        <div className="absolute bottom-4 left-4 w-20 h-20 rounded-full bg-black/30 blur-xl" />
      </div>

      {/* Icon / illustration placeholder */}
      <div className="absolute inset-0 flex items-center justify-center">
        <GameIllustration id={game.id} />
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-2xl">
          <Play className="w-6 h-6 text-slate-900 ml-0.5" fill="currentColor" />
        </div>
      </div>

      {/* Name pill at bottom */}
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
        <div className="text-white font-extrabold text-lg tracking-wide drop-shadow-md">
          {game.name}
        </div>
        <div className="text-white/80 text-[10px] font-medium tracking-wider uppercase mt-0.5">
          {game.category || game.provider}
        </div>
      </div>
    </button>
  );
}

function GameIllustration({ id }) {
  // Simple thematic emoji-free illustrations per game using SVG shapes.
  switch (id) {
    case "slide":
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24">
          <rect x="10" y="55" width="80" height="12" rx="6" fill="#1a1a1a" />
          <circle cx="25" cy="61" r="9" fill="#fff" />
          <text x="50" y="40" fontSize="22" fontWeight="900" textAnchor="middle" fill="#1a1a1a">1000x</text>
        </svg>
      );
    case "roulette":
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24">
          <circle cx="50" cy="55" r="32" fill="#1a1a1a" stroke="#f5c518" strokeWidth="3" />
          <circle cx="50" cy="55" r="10" fill="#f5c518" />
          <rect x="48" y="18" width="4" height="18" fill="#f5c518" />
        </svg>
      );
    case "blackjack":
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24">
          <rect x="20" y="25" width="36" height="50" rx="5" fill="#fff" transform="rotate(-10 38 50)" />
          <rect x="44" y="25" width="36" height="50" rx="5" fill="#fff" transform="rotate(8 62 50)" />
          <text x="52" y="58" fontSize="16" fontWeight="900" fill="#dc2626" transform="rotate(8 52 58)">A</text>
        </svg>
      );
    case "hilo":
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24">
          <path d="M20 70 L50 30 L80 70" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" />
          <circle cx="50" cy="30" r="5" fill="#fff" />
        </svg>
      );
    case "dice":
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24">
          <rect x="20" y="20" width="60" height="60" rx="10" fill="#fff" />
          <circle cx="35" cy="35" r="5" fill="#0a0f1e" />
          <circle cx="65" cy="35" r="5" fill="#0a0f1e" />
          <circle cx="50" cy="50" r="5" fill="#0a0f1e" />
          <circle cx="35" cy="65" r="5" fill="#0a0f1e" />
          <circle cx="65" cy="65" r="5" fill="#0a0f1e" />
        </svg>
      );
    case "mines":
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24">
          <circle cx="50" cy="55" r="22" fill="#1a1a1a" />
          <rect x="48" y="25" width="4" height="12" fill="#fbbf24" />
          <circle cx="50" cy="23" r="4" fill="#f97316" />
        </svg>
      );
    case "plinko":
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24">
          {[0, 1, 2, 3].map((row) =>
            Array.from({ length: row + 2 }).map((_, i) => (
              <circle key={`${row}-${i}`} cx={30 + i * 12 - row * 6} cy={30 + row * 12} r="3" fill="#fff" />
            ))
          )}
        </svg>
      );
    case "crash":
      return (
        <svg viewBox="0 0 100 100" className="w-24 h-24">
          <path d="M15 80 Q40 70 55 45 T85 15" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" />
          <text x="50" y="60" fontSize="14" fontWeight="900" textAnchor="middle" fill="#fff">2.5x</text>
        </svg>
      );
    default:
      return (
        <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center">
          <div className="w-10 h-10 rounded-lg bg-white/40" />
        </div>
      );
  }
}
