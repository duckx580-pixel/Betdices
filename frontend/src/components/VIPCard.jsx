import React from "react";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function VIPCard() {
  const { user } = useAuth();
  const vip = user?.vip || {};
  const level = vip.level || "Bronze 1";
  const nextLevel = vip.next_level || vip.nextLevel || "Bronze 2";
  const progress = vip.progress ?? 0;
  const xp = vip.xp ?? 0;
  const xpToNext = vip.xp_to_next ?? vip.xpToNext ?? 1000;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#131c2f] border border-white/5 p-5 md:p-6 shadow-xl">
      <div className="absolute -right-4 top-1/2 -translate-y-1/2 pointer-events-none">
        <VIPBadge />
      </div>
      <div className="relative z-10 max-w-[70%]">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          Welcome, <span className="text-white">{user?.username}</span>
        </h1>
        <div className="mt-8 md:mt-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-slate-300 text-sm">
              <span>Your VIP Progress</span>
              <ArrowRight className="w-4 h-4" />
            </div>
            <div className="font-extrabold text-white">{nextLevel}</div>
          </div>
          <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full vip-shimmer rounded-full transition-[width] duration-700" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <MiniBadge />
            <span className="text-yellow-400 font-bold tracking-wider text-sm">{level.toUpperCase()}</span>
            <span className="text-slate-500 text-xs ml-auto">{xp} / {xpToNext} XP</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function VIPBadge() {
  return (
    <svg width="180" height="180" viewBox="0 0 200 200" className="opacity-95">
      <defs>
        <linearGradient id="gold-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="50%" stopColor="#ffb800" />
          <stop offset="100%" stopColor="#c98800" />
        </linearGradient>
      </defs>
      <polygon points="100,20 175,75 145,170 55,170 25,75" fill="url(#gold-grad)" stroke="#8a5a00" strokeWidth="3" />
      <polygon points="100,35 160,80 137,158 63,158 40,80" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.5" />
    </svg>
  );
}

function MiniBadge() {
  return (
    <svg width="22" height="22" viewBox="0 0 200 200">
      <defs>
        <linearGradient id="mini-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="100%" stopColor="#c98800" />
        </linearGradient>
      </defs>
      <polygon points="100,20 175,75 145,170 55,170 25,75" fill="url(#mini-gold)" stroke="#8a5a00" strokeWidth="5" />
    </svg>
  );
}
