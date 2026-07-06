import React, { useState } from "react";
import { Info, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { withdrawApi } from "../../lib/api";

const WITHDRAW_WORLD = "BETDICEWITHDRAW";

export default function WithdrawFlow({ onSubmitted }) {
  const { user, balance, refresh } = useAuth();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("DL");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return toast.error("Enter a valid amount");
    if (currency === "DL" && n < 5) return toast.error("Minimum withdrawal: 5 DL");
    if (currency === "BGL" && n > 200) return toast.error("Maximum: 200 BGL");

    setBusy(true);
    try {
      await withdrawApi.create({ amount: n, currency, grow_id: user.grow_id });
      toast.success(`${n} ${currency} withdrawal requested`);
      await refresh();
      onSubmitted?.();
      setDone(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setDone(false); setAmount(""); };

  if (done) {
    return (
      <div className="bg-[#131c2f] border border-white/5 rounded-2xl p-8 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center pop-in mb-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400" />
        </div>
        <h3 className="text-2xl font-extrabold">Withdrawal Requested</h3>
        <p className="text-slate-400 mt-2">
          <b className="text-orange-400">{amount} {currency}</b> will be delivered to <span className="font-mono">{user.grow_id}</span> in world <span className="font-mono text-teal-400">{WITHDRAW_WORLD}</span> after admin approval.
        </p>
        <button onClick={reset} className="mt-6 w-full h-12 rounded-xl bg-[#3583ff] hover:bg-[#2872ef] transition-colors font-bold text-white">
          New Withdrawal
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#131c2f] border border-white/5 rounded-2xl p-5 md:p-6 space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
        <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-300">
          Locks will be sent to <b>{user.grow_id}</b> in world <b className="font-mono">{WITHDRAW_WORLD}</b> after admin approval.
        </p>
      </div>

      <div>
        <label className="text-sm font-semibold text-slate-300 mb-1.5 block">Currency</label>
        <div className="grid grid-cols-2 gap-2">
          {["DL", "BGL"].map((c) => (
            <button key={c} onClick={() => setCurrency(c)} className={`h-14 rounded-xl font-bold transition-all text-center ${currency === c ? "bg-[#3583ff] text-white" : "bg-[#0a0f1e] border border-white/10 text-slate-300 hover:bg-white/5"}`}>
              <div>{c === "DL" ? "Diamond Locks" : "Blue Gem Locks"}</div>
              <div className="text-xs opacity-70 font-normal">Balance: {balance[c.toLowerCase()].toFixed(2)}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-slate-300 mb-1.5 block">Amount ({currency})</label>
        <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={currency === "DL" ? "Min 5" : "Max 200"} className="w-full h-12 px-4 rounded-xl bg-[#0a0f1e] border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3583ff]/50 font-bold text-lg" />
        <div className="flex gap-2 mt-2">
          {[5, 10, 25, 50].map((v) => (
            <button key={v} onClick={() => setAmount(String(v))} className="flex-1 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300">{v}</button>
          ))}
        </div>
      </div>

      <button onClick={submit} disabled={busy} className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors font-bold text-white flex items-center justify-center gap-2">
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <>Request Withdrawal <ArrowRight className="w-4 h-4" /></>}
      </button>
    </div>
  );
}
