import { useState } from "react";
import { toast } from "sonner";
import { gamesApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { playGameActionSound, playGameWinSound, playGameLoseSound } from "../lib/gameAudio";

export function useBet() {
  const { balance, setUser } = useAuth();
  const [busy, setBusy] = useState(false);

  const place = async ({ game, bet, won, multiplier, meta }) => {
    if (bet <= 0) {
      toast.error("Bet must be > 0");
      return null;
    }
    if (bet > balance.dl) {
      toast.error("Insufficient DL balance");
      return null;
    }
    const payout = won ? +(bet * (multiplier || 0)).toFixed(4) : 0;
    playGameActionSound();
    setBusy(true);
    try {
      const res = await gamesApi.bet({ game, bet, payout, won, multiplier, meta });
      // update balance & vip locally
      setUser((u) => (u ? { ...u, balance: res.balance, vip: res.vip } : u));
      if (won) {
        playGameWinSound(multiplier);
      } else {
        playGameLoseSound();
      }
      return res;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Bet failed");
      return null;
    } finally {
      setBusy(false);
    }
  };

  return { place, busy, balance };
}
