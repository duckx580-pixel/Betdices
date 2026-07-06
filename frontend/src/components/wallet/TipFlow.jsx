import React, { useState } from "react";
import { Send, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { tipApi } from "../../lib/api";

export default function TipFlow() {
  const { balance, refresh } = useAuth();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const n = parseFloat(amount);
    if (!recipient.trim()) return toast.error("Enter recipient username");
    if (!n || n <= 0) return toast.error("Enter valid amount");
    if (balance.dl < n) return toast.error("Insufficient DL balance");
    setBusy(true);
    try {
      await tipApi.send({ to_username: recipient.trim().toUpperCase(), amount: n, message });
      toast.success(`Tipped ${n} DL to ${recipient}`);
      await refresh();
      setDone(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setDone(false); setRecipient(""); setAmount(""); setMessage(""); };

  if (done) {
    return (
      <div className="bg-[#131c2f] border border-white/5 rounded-2xl p-8 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-purple-500/15 flex items-center justify-center pop-in mb-3">
          <CheckCircle2 className="w-12 h-12 text-purple-400" />
        </div>
        <h3 className="text-2xl font-extrabold">Tip Sent!</h3>
        <p className="text-slate-400 mt-2">
          You tipped <b className="text-purple-400">{amount} DL</b> to <b className="font-mono">{recipient.toUpperCase()}</b>.
        </p>
        <button onClick={reset} className="mt-6 w-full h-12 rounded-xl bg-[#3583ff] hover:bg-[#2872ef] transition-colors font-bold text-white">New Tip</button>
      </div>
    );
  }

  return (
    <div className="bg-[#131c2f] border border-white/5 rounded-2xl p-5 md:p-6 space-y-4">
      <div>
        <label className="text-sm font-semibold text-slate-300 mb-1.5 block">Recipient Username</label>
        <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="e.g. LUCKYDUDE" className="w-full h-12 px-4 rounded-xl bg-[#0a0f1e] border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3583ff]/50" />
      </div>
      <div>
        <label className="text-sm font-semibold text-slate-300 mb-1.5 block">Amount (DL)</label>
        <input type="number" min="0.1" step="0.1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1" className="w-full h-12 px-4 rounded-xl bg-[#0a0f1e] border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3583ff]/50 font-bold text-lg" />
        <div className="text-xs text-slate-400 mt-1.5">Available: {balance.dl.toFixed(2)} DL</div>
      </div>
      <div>
        <label className="text-sm font-semibold text-slate-300 mb-1.5 block">Message (optional)</label>
        <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="gg wp!" maxLength={80} className="w-full h-12 px-4 rounded-xl bg-[#0a0f1e] border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3583ff]/50" />
      </div>
      <button onClick={submit} disabled={busy} className="w-full h-12 rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 transition-colors font-bold text-white flex items-center justify-center gap-2">
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><Send className="w-4 h-4" /> Send Tip</>}
      </button>
    </div>
  );
}
