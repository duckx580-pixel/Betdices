import React, { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Send } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "../context/AuthContext";
import { depositApi, logApiError, withdrawApi } from "../lib/api";
import DepositHub from "../components/wallet/DepositHub";
import WithdrawFlow from "../components/wallet/WithdrawFlow";
import TipFlow from "../components/wallet/TipFlow";
import TxHistory from "../components/wallet/TxHistory";

export default function Wallet() {
  const { balance, logout } = useAuth();
  const [deposits, setDeposits] = useState([]);
  const [withdraws, setWithdraws] = useState([]);
  const [historyError, setHistoryError] = useState("");

  const loadHistory = async () => {
    try {
      const [d, w] = await Promise.all([depositApi.mine(), withdrawApi.mine()]);
      setDeposits(d || []);
      setWithdraws(w || []);
      setHistoryError("");
    } catch (e) {
      logApiError("wallet-load-history", e);
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail || e?.message || "Failed to load wallet history";
      setHistoryError(detail);
      if (status === 401) logout();
      console.error("[Wallet] history fetch failed", {
        status,
        data: e?.response?.data,
        headers: e?.response?.headers,
      });
    }
  };

  useEffect(() => {
    loadHistory();
    const t = setInterval(loadHistory, 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="pt-2">
      <h1 className="text-2xl md:text-3xl font-extrabold mb-4">Wallet</h1>
      {historyError ? <p className="mb-4 text-sm text-rose-300">{historyError}</p> : null}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <BalanceCard label="Diamond Locks" amount={balance.dl.toFixed(2)} unit="DL" gradient="from-teal-500/20 to-teal-500/5" accent="text-teal-400" />
        <BalanceCard label="Blue Gem Locks" amount={balance.bgl.toFixed(2)} unit="BGL" gradient="from-blue-500/20 to-blue-500/5" accent="text-blue-400" />
        <BalanceCard label="World Locks" amount={balance.wl.toFixed(0)} unit="WL" gradient="from-slate-500/20 to-slate-500/5" accent="text-slate-300" />
      </div>

      <Tabs defaultValue="deposit" className="w-full">
        <TabsList className="grid grid-cols-3 w-full bg-[#131c2f] border border-white/5 h-12 rounded-xl p-1">
          <TabsTrigger value="deposit" className="data-[state=active]:bg-[#3583ff] data-[state=active]:text-white text-slate-300 rounded-lg font-semibold">
            <ArrowDownToLine className="w-4 h-4 mr-1.5" /> Deposit
          </TabsTrigger>
          <TabsTrigger value="withdraw" className="data-[state=active]:bg-[#3583ff] data-[state=active]:text-white text-slate-300 rounded-lg font-semibold">
            <ArrowUpFromLine className="w-4 h-4 mr-1.5" /> Withdraw
          </TabsTrigger>
          <TabsTrigger value="tip" className="data-[state=active]:bg-[#3583ff] data-[state=active]:text-white text-slate-300 rounded-lg font-semibold">
            <Send className="w-4 h-4 mr-1.5" /> Tip
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deposit" className="mt-4">
          <DepositHub onSubmitted={loadHistory} />
        </TabsContent>
        <TabsContent value="withdraw" className="mt-4">
          <WithdrawFlow onSubmitted={loadHistory} />
        </TabsContent>
        <TabsContent value="tip" className="mt-4">
          <TipFlow />
        </TabsContent>
      </Tabs>

      <TxHistory deposits={deposits} withdraws={withdraws} />
    </div>
  );
}

function BalanceCard({ label, amount, unit, gradient, accent }) {
  return (
    <div className={`bg-gradient-to-br ${gradient} border border-white/5 rounded-2xl p-3 md:p-4`}>
      <div className="text-slate-400 text-xs font-medium">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-xl md:text-2xl font-extrabold ${accent}`}>{amount}</span>
        <span className="text-slate-400 text-xs font-semibold">{unit}</span>
      </div>
    </div>
  );
}
