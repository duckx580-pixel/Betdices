import React from "react";
import { NavLink } from "react-router-dom";
import { Search, Home, Wallet, MessageCircle, Package, Swords } from "lucide-react";

const items = [
  { to: "/browse", label: "Browse", icon: Search },
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/cases", label: "Cases", icon: Package },
  { to: "/battles", label: "Battles", icon: Swords },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/chat", label: "Chat", icon: MessageCircle },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#0a0f1e]/95 backdrop-blur-md border-t border-white/5">
      <div className="max-w-[1200px] mx-auto px-4 grid grid-cols-6 h-20 items-center">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 no-select transition-colors ${
                isActive ? "text-white" : "text-slate-400 hover:text-slate-200"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`w-11 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isActive ? "bg-[#3583ff]/15" : ""
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "text-[#3583ff]" : ""}`} strokeWidth={2.2} />
                </div>
                <span className="text-xs font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
