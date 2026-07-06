import React, { useEffect, useState } from "react";
import { configApi } from "../../lib/api";
import GrowtopiaDeposit from "./methods/GrowtopiaDeposit";
import QRISDeposit from "./methods/QRISDeposit";
import DANADeposit from "./methods/DANADeposit";
import PayPalDeposit from "./methods/PayPalDeposit";

const methods = [
  { id: "growtopia", name: "Growtopia Locks", desc: "DL / BGL via bot trade", color: "emerald" },
  { id: "qris", name: "QRIS", desc: "Scan QR (Indonesia)", color: "blue" },
  { id: "dana", name: "DANA", desc: "Indonesian e-wallet", color: "sky" },
  { id: "paypal", name: "PayPal", desc: "USD international", color: "indigo" },
];

export default function DepositHub({ onSubmitted }) {
  const [config, setConfig] = useState(null);
  const [active, setActive] = useState("growtopia");

  useEffect(() => {
    configApi.get().then(setConfig).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {methods.map((m) => (
          <button
            key={m.id}
            onClick={() => setActive(m.id)}
            className={`p-3 rounded-xl border transition-all text-left ${
              active === m.id
                ? "bg-[#3583ff] border-[#3583ff] text-white"
                : "bg-[#131c2f] border-white/5 hover:border-white/20 text-slate-200"
            }`}
          >
            <div className="font-bold text-sm">{m.name}</div>
            <div className="text-[11px] opacity-80 mt-0.5">{m.desc}</div>
          </button>
        ))}
      </div>

      {active === "growtopia" && <GrowtopiaDeposit onSubmitted={onSubmitted} />}
      {active === "qris" && <QRISDeposit config={config} onSubmitted={onSubmitted} />}
      {active === "dana" && <DANADeposit config={config} onSubmitted={onSubmitted} />}
      {active === "paypal" && <PayPalDeposit config={config} onSubmitted={onSubmitted} />}
    </div>
  );
}
