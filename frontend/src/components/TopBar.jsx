import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dice5, ChevronDown, Wallet as WalletIcon, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function TopBar() {
  const { user, balance, logout } = useAuth();
  const navigate = useNavigate();
  const totalDL = balance.dl + balance.bgl * 100;

  return (
    <header className="sticky top-0 z-40 bg-[#0a0f1e]/95 backdrop-blur-md border-b border-white/5">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-300 flex items-center justify-center shadow-lg">
            <Dice5 className="w-6 h-6 text-slate-800" strokeWidth={2.5} />
          </div>
          <span className="font-extrabold text-lg hidden sm:block tracking-tight">BetDice</span>
        </Link>

        <div className="flex items-center gap-0 bg-[#131c2f] rounded-full overflow-hidden border border-white/5">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors">
              <div className="w-6 h-6 rounded-md bg-teal-500/20 flex items-center justify-center">
                <span className="text-teal-400 text-xs font-bold">DL</span>
              </div>
              <span className="font-semibold text-sm min-w-[20px] text-center">{totalDL.toFixed(0)}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#131c2f] border-white/10 text-white">
              <DropdownMenuLabel>Your Balance</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem className="flex justify-between focus:bg-white/5">
                <span>Diamond Locks</span><span className="font-bold text-teal-400">{balance.dl.toFixed(2)}</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex justify-between focus:bg-white/5">
                <span>Blue Gem Locks</span><span className="font-bold text-blue-400">{balance.bgl.toFixed(2)}</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex justify-between focus:bg-white/5">
                <span>World Locks</span><span className="font-bold text-slate-300">{balance.wl.toFixed(0)}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button onClick={() => navigate("/wallet")} className="px-4 py-2 bg-[#3583ff] hover:bg-[#2872ef] transition-colors flex items-center gap-2 font-semibold text-sm">
            <WalletIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Wallet</span>
          </button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="shrink-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden ring-2 ring-yellow-500/50 shadow-lg hover:ring-yellow-400 transition-all">
              <img src={user?.avatar || "https://i.pravatar.cc/80"} alt="avatar" className="w-full h-full object-cover" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#131c2f] border-white/10 text-white" align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-bold">{user?.username}</span>
                <span className="text-xs text-slate-400">GrowID: {user?.grow_id}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem className="focus:bg-white/5" onClick={() => navigate("/wallet")}>
              <WalletIcon className="w-4 h-4 mr-2" /> Wallet
            </DropdownMenuItem>
            {user?.is_admin && (
              <DropdownMenuItem className="focus:bg-white/5 text-yellow-400" onClick={() => navigate("/admin")}>
                <ShieldCheck className="w-4 h-4 mr-2" /> Admin Panel
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="focus:bg-white/5 text-red-400" onClick={() => { logout(); navigate("/login"); }}>
              <LogOut className="w-4 h-4 mr-2" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
