import React, { useRef, useState } from "react";
import { Copy, CheckCircle2, Info, Loader2, Upload, X, QrCode } from "lucide-react";
import { toast } from "sonner";
import { depositApi } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";

export default function QRISDeposit({ config, onSubmitted }) {
  return (
    <FiatDeposit
      method="qris"
      currency="IDR"
      label="QRIS"
      rate={config?.rate_idr_per_dl || 10000}
      qrImage={config?.qris_image_url}
      recipient={{ label: "Merchant", value: "BetDice QRIS" }}
      instructions={[
        "Scan the QR above using any e-wallet or bank app that supports QRIS (GoPay, OVO, DANA, ShopeePay, BCA Mobile, etc).",
        "Pay the exact amount shown below.",
        "Take a screenshot of the successful payment.",
        "Upload the screenshot and submit for verification.",
      ]}
      onSubmitted={onSubmitted}
    />
  );
}

export function FiatDeposit({ method, currency, label, rate, qrImage, recipient, instructions, onSubmitted }) {
  const { refresh } = useAuth();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState(null); // { name, dataUrl }
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef(null);

  const numAmount = parseFloat(amount) || 0;
  const dlEquiv = numAmount > 0 ? (numAmount / rate).toFixed(4) : "0";

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) {
      toast.error("Image too large (max 3MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProof({ name: f.name, dataUrl: reader.result });
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (numAmount <= 0) return toast.error("Enter amount");
    if (!proof) return toast.error("Upload payment proof screenshot");
    setBusy(true);
    try {
      await depositApi.create({
        method,
        amount: numAmount,
        currency,
        proof_image: proof.dataUrl,
        reference: reference || null,
        note: `${label} payment`,
      });
      toast.success("Submitted! Waiting for admin to accept payment.");
      onSubmitted?.();
      await refresh();
      setSubmitted(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to submit");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSubmitted(false);
    setAmount("");
    setReference("");
    setProof(null);
  };

  if (submitted) {
    return (
      <div className="bg-[#131c2f] border border-white/5 rounded-2xl p-8 text-center space-y-4">
        <div className="w-20 h-20 mx-auto rounded-full bg-yellow-500/15 flex items-center justify-center pop-in">
          <ClockIcon />
        </div>
        <h3 className="text-2xl font-extrabold">Payment Submitted</h3>
        <p className="text-slate-400">
          Your payment of <b className="text-white">{numAmount.toLocaleString()} {currency}</b> ({dlEquiv} DL) is being verified by the admin. Balance will update once approved.
        </p>
        <button onClick={reset} className="w-full h-12 rounded-xl bg-[#3583ff] hover:bg-[#2872ef] transition-colors font-bold text-white">
          Make Another Payment
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#131c2f] border border-white/5 rounded-2xl p-5 md:p-6 space-y-4">
      {/* Payment target */}
      {qrImage && (
        <div className="flex flex-col items-center gap-3 pb-4 border-b border-white/5">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5" /> Scan to pay
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-2xl">
            <img src={qrImage} alt="QRIS QR Code" className="w-56 h-56 object-contain" />
          </div>
          <div className="text-xs text-slate-400">Any QRIS-supported wallet works</div>
        </div>
      )}

      {recipient && !qrImage && (
        <CopyBox label={recipient.label} value={recipient.value} />
      )}

      <div className="space-y-2 text-xs text-slate-300">
        {instructions?.map((step, i) => (
          <div key={i} className="flex gap-2">
            <div className="w-5 h-5 rounded-full bg-[#3583ff]/20 text-[#3583ff] font-bold flex items-center justify-center shrink-0 text-[10px]">
              {i + 1}
            </div>
            <p>{step}</p>
          </div>
        ))}
      </div>

      <div>
        <label className="text-sm font-semibold text-slate-300 mb-1.5 block">Amount ({currency})</label>
        <input
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={currency === "IDR" ? "e.g. 50000" : "e.g. 5.00"}
          className="w-full h-12 px-4 rounded-xl bg-[#0a0f1e] border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3583ff]/50 font-bold text-lg"
        />
        <div className="mt-1.5 text-xs text-slate-400">
          You will receive: <b className="text-emerald-400">{dlEquiv} DL</b>
          <span className="ml-2 text-slate-500">(Rate: 1 DL = {rate.toLocaleString()} {currency})</span>
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-slate-300 mb-1.5 block">Reference / Transaction ID (optional)</label>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. TRX123456"
          className="w-full h-11 px-4 rounded-xl bg-[#0a0f1e] border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3583ff]/50"
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-slate-300 mb-1.5 block">Payment Proof Screenshot *</label>
        <input type="file" accept="image/*" ref={fileRef} onChange={onFile} className="hidden" />
        {!proof ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full h-24 rounded-xl border-2 border-dashed border-white/10 hover:border-[#3583ff]/50 bg-[#0a0f1e] flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-white transition-colors"
          >
            <Upload className="w-5 h-5" />
            <span className="text-sm font-medium">Upload screenshot</span>
            <span className="text-[10px]">Max 3MB — JPG/PNG</span>
          </button>
        ) : (
          <div className="relative rounded-xl overflow-hidden border border-white/10">
            <img src={proof.dataUrl} alt="proof" className="w-full max-h-64 object-contain bg-[#0a0f1e]" />
            <button
              onClick={() => setProof(null)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 hover:bg-red-500 flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/70 text-white text-xs">
              {proof.name}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={submit}
        disabled={busy}
        className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 transition-colors font-bold text-white flex items-center justify-center gap-2"
      >
        {busy ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
        ) : (
          `Submit ${label} Payment`
        )}
      </button>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-500/10 border border-white/5">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400">
          After submission, the admin will verify and credit your balance. Please make sure the proof matches the amount you entered.
        </p>
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg className="w-12 h-12 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        <div className="font-mono font-bold text-white tracking-wide break-all">{value}</div>
      </div>
      <button onClick={copy} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors shrink-0 ml-2">
        {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
      </button>
    </div>
  );
}
