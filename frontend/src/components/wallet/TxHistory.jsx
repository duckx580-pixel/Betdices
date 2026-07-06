import React from "react";
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Clock, XCircle } from "lucide-react";

const statusIcon = {
  approved: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  completed: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  pending: <Clock className="w-4 h-4 text-yellow-400" />,
  rejected: <XCircle className="w-4 h-4 text-red-400" />,
  failed: <XCircle className="w-4 h-4 text-red-400" />,
};

export default function TxHistory({ deposits = [], withdraws = [] }) {
  const items = [
    ...deposits.map((d) => ({ ...d, kind: "deposit" })),
    ...withdraws.map((w) => ({ ...w, kind: "withdraw" })),
  ].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  return (
    <div className="mt-8">
      <h2 className="text-lg font-bold mb-3">Transaction History</h2>
      {items.length === 0 ? (
        <div className="bg-[#131c2f] border border-white/5 rounded-2xl p-6 text-center text-slate-400 text-sm">
          No transactions yet.
        </div>
      ) : (
        <div className="bg-[#131c2f] border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
          {items.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                {tx.kind === "deposit" ? (
                  <ArrowDownToLine className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ArrowUpFromLine className="w-4 h-4 text-orange-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold capitalize">
                  {tx.kind}{" "}
                  {tx.method && (
                    <span className="text-slate-400 text-xs font-medium ml-1">via {tx.method}</span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {new Date(tx.created_at).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-bold ${tx.kind === "deposit" ? "text-emerald-400" : "text-orange-400"}`}>
                  {tx.kind === "deposit" ? "+" : "-"}
                  {(tx.dl_credit ?? tx.amount).toFixed?.(2) ?? tx.amount} {tx.currency || "DL"}
                </div>
                <div className="flex items-center gap-1 justify-end text-xs text-slate-400 mt-0.5">
                  {statusIcon[tx.status] || null} <span className="capitalize">{tx.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
