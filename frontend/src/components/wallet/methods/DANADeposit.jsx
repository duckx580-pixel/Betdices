import React from "react";
import { FiatDeposit } from "./QRISDeposit";

export default function DANADeposit({ config, onSubmitted }) {
  return (
    <FiatDeposit
      method="dana"
      currency="IDR"
      label="DANA"
      rate={config?.rate_idr_per_dl || 10000}
      recipient={null}
      qrImage={null}
      instructions={[
        `Open your DANA app and transfer to phone number: ${config?.dana_phone || "+62..."}`,
        `Recipient name should be: ${config?.dana_name || "..."}`,
        "Enter the amount you want to deposit and complete the transfer.",
        "Screenshot the success receipt and upload below.",
      ]}
      onSubmitted={onSubmitted}
    >
      <DANAInfo config={config} />
    </FiatDeposit>
  );
}

function DANAInfo({ config }) {
  return (
    <div className="grid grid-cols-1 gap-2 mb-2">
      <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
        <div className="text-[10px] uppercase tracking-wider text-sky-400 font-semibold">DANA Phone</div>
        <div className="font-mono font-bold text-white tracking-wide">{config?.dana_phone}</div>
      </div>
      <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
        <div className="text-[10px] uppercase tracking-wider text-sky-400 font-semibold">Account Name</div>
        <div className="font-mono font-bold text-white tracking-wide">{config?.dana_name}</div>
      </div>
    </div>
  );
}
