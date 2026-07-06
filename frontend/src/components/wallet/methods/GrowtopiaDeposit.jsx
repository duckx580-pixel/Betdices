import React, { useEffect, useState } from "react";
import { Copy, CheckCircle2, Info, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../context/AuthContext";
import { depositApi } from "../../../lib/api";

const DEPOSIT_WORLDS = ["BETDICEDEPOSIT", "BETDICEDEP2", "BETDICEDEP3"];

export default function GrowtopiaDeposit({ onSubmitted }) {
  const { user, refresh } = useAuth();
  const [step, setStep] = useState(1);
  const [growId] = useState(user?.grow_id || "");
  const [amount, setAmount] = useState("");
  const [worldName, setWorldName] = useState("");
  const [botName] = useState("BETDICEBOT");
  const [busy, setBusy] = useState(false);

  const startDeposit = () => {
    const n = parseFloat(amount);
    if (!n || n < 5) {
      toast.error("Minimum 5 DL");
      return;
    }
    if (n > 20000) {
      toast.error("Maximum 200 BGL (20,000 DL)");
      return;
    }
    const world = DEPOSIT_WORLDS[Math.floor(Math.random() * DEPOSIT_WORLDS.length)];
    setWorldName(world);
    setStep(2);
  };

  const submitToBackend = async () => {
    setBusy(true);
    try {
      await depositApi.create({
        method: "growtopia",
        amount: parseFloat(amount),
        currency: "DL",
        reference: `${growId}->${botName}@${worldName}`,
        note: `Growtopia trade in ${worldName}`,
      });
      toast.success("Deposit request submitted! Awaiting admin approval.");
      onSubmitted?.();
      await refresh();
      setStep(3);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to submit");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep(1);
    setAmount("");
    setWorldName("");
  };

  return (
    <div className="bg-[#131c2f] border border-white/5 rounded-2xl p-5 md:p-6">
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-300">
              Enter how many DLs you want to deposit. The bot will only accept trades from GrowID <b>{growId}</b>.
            </p>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-300 mb-1.5 block">Amount (DL)</label>
            <input
              type="number"
              min="5"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Min 5, Max 20000 DL"
              className="w-full h-12 px-4 rounded-xl bg-[#0a0f1e] border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3583ff]/50 font-bold text-lg"
            />
          </div>
          <button
            onClick={startDeposit}
            className="w-full h-12 rounded-xl bg-[#3583ff] hover:bg-[#2872ef] transition-colors font-bold text-white flex items-center justify-center gap-2"
          >
            Get Deposit World <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/15 text-yellow-400 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Trade the bot in-game
            </div>
            <h3 className="text-xl font-bold">Meet the Deposit Bot</h3>
          </div>
          <CopyBox label="World Name" value={worldName} />
          <CopyBox label="Bot GrowID" value={botName} />
          <CopyBox label="Your GrowID" value={growId} />
          <CopyBox label="Amount to trade" value={`${amount} DL`} />
          <div className="p-3 rounded-lg bg-slate-500/10 border border-white/5 text-xs text-slate-300 space-y-1">
            <p>1. Go to <b>{worldName}</b> in Growtopia.</p>
            <p>2. Trade <b>{amount} DL</b> to <b>{botName}</b>.</p>
            <p>3. Click below to submit for admin verification.</p>
          </div>
          <button
            onClick={submitToBackend}
            disabled={busy}
            className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 transition-colors font-bold text-white flex items-center justify-center gap-2"
          >
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : "I've Traded — Submit"}
          </button>
          <button onClick={reset} className="w-full text-xs text-slate-400 hover:text-slate-200">Cancel</button>
        </div>
      )}

      {step === 3 && (
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-yellow-500/15 flex items-center justify-center pop-in">
            <Clock className="w-12 h-12 text-yellow-400" />
          </div>
          <h3 className="text-2xl font-extrabold">Awaiting Approval</h3>
          <p className="text-slate-400">
            Your deposit of <b className="text-emerald-400">{amount} DL</b> is pending admin verification. You'll see it credited once approved.
          </p>
          <button onClick={reset} className="w-full h-12 rounded-xl bg-[#3583ff] hover:bg-[#2872ef] transition-colors font-bold text-white">
            New Deposit
          </button>
        </div>
      )}
    </div>
  );
}

function Clock({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CopyBox({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`${label} copied`);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-[#0a0f1e] border border-white/10">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
        <div className="font-mono font-bold text-white tracking-wide">{value}</div>
      </div>
      <button onClick={copy} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
        {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
      </button>
    </div>
  );
}
