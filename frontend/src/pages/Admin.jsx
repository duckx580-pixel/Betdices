import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, CheckCircle2, XCircle, Loader2, Users, Wallet, DollarSign, Gamepad2 } from "lucide-react";
import { adminApi, casesApi } from "../lib/api";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function Admin() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [withdraws, setWithdraws] = useState([]);
  const [growtopiaItems, setGrowtopiaItems] = useState([]);
  const [allCases, setAllCases] = useState([]);
  const [busy, setBusy] = useState({});

  const load = useCallback(async () => {
    try {
      const [s, d, w, gtItems, caseList] = await Promise.all([
        adminApi.stats(),
        adminApi.deposits(),
        adminApi.withdraws(),
        adminApi.growtopiaItems(),
        casesApi.list(false),
      ]);
      setStats(s); setDeposits(d); setWithdraws(w); setGrowtopiaItems(gtItems || []); setAllCases(caseList || []);
    } catch (e) {
      toast.error("Failed to load admin data");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const decideDeposit = async (id, status) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await adminApi.decideDeposit(id, status);
      toast.success(`Deposit ${status}`);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const decideWithdraw = async (id, status) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await adminApi.decideWithdraw(id, status);
      toast.success(`Withdraw ${status}`);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const pendingDeposits = deposits.filter((d) => d.status === "pending");
  const otherDeposits = deposits.filter((d) => d.status !== "pending");

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white pb-16">
      <div className="sticky top-0 z-40 bg-[#0a0f1e]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="w-10 h-10 rounded-lg bg-[#131c2f] hover:bg-white/10 flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-yellow-400" />
              <h1 className="text-xl font-extrabold">Admin Dashboard</h1>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-yellow-500/15 border border-yellow-500/20 text-yellow-400 text-xs font-semibold">
            OWNER MODE
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard icon={<Users className="w-4 h-4 text-blue-400" />} label="Users" value={stats.users} />
            <StatCard icon={<Wallet className="w-4 h-4 text-yellow-400" />} label="Pending Deposits" value={stats.pending_deposits} highlight={stats.pending_deposits > 0} />
            <StatCard icon={<DollarSign className="w-4 h-4 text-orange-400" />} label="Pending Withdraws" value={stats.pending_withdraws} highlight={stats.pending_withdraws > 0} />
            <StatCard icon={<Gamepad2 className="w-4 h-4 text-purple-400" />} label="Total Bets" value={stats.total_bets} />
          </div>
        )}

        <Tabs defaultValue="deposits" className="w-full">
          <TabsList className="bg-[#131c2f] border border-white/5 h-12 rounded-xl p-1">
            <TabsTrigger value="deposits" className="data-[state=active]:bg-[#3583ff] data-[state=active]:text-white text-slate-300 rounded-lg font-semibold px-4">
              Deposits ({pendingDeposits.length})
            </TabsTrigger>
            <TabsTrigger value="withdraws" className="data-[state=active]:bg-[#3583ff] data-[state=active]:text-white text-slate-300 rounded-lg font-semibold px-4">
              Withdraws ({withdraws.filter((w) => w.status === "pending").length})
            </TabsTrigger>
            <TabsTrigger value="cases" className="data-[state=active]:bg-[#3583ff] data-[state=active]:text-white text-slate-300 rounded-lg font-semibold px-4">
              Cases ({allCases.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deposits" className="mt-4 space-y-3">
            <SectionTitle>Pending ({pendingDeposits.length})</SectionTitle>
            {pendingDeposits.length === 0 ? (
              <EmptyState msg="No pending deposits" />
            ) : (
              pendingDeposits.map((d) => (
                <DepositCard key={d.id} d={d} busy={busy[d.id]} onDecide={decideDeposit} />
              ))
            )}

            {otherDeposits.length > 0 && (
              <>
                <SectionTitle>Recent ({otherDeposits.length})</SectionTitle>
                {otherDeposits.slice(0, 20).map((d) => (
                  <DepositCard key={d.id} d={d} readOnly />
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="withdraws" className="mt-4 space-y-3">
            {withdraws.length === 0 ? (
              <EmptyState msg="No withdrawals yet" />
            ) : (
              withdraws.map((w) => (
                <WithdrawCard key={w.id} w={w} busy={busy[w.id]} onDecide={decideWithdraw} />
              ))
            )}
          </TabsContent>

          <TabsContent value="cases" className="mt-4 space-y-3">
            <CaseCreatorPanel growtopiaItems={growtopiaItems} allCases={allCases} onCreated={load} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, highlight }) {
  return (
    <div className={`p-4 rounded-2xl border ${highlight ? "bg-yellow-500/10 border-yellow-500/30" : "bg-[#131c2f] border-white/5"}`}>
      <div className="flex items-center gap-1.5 text-xs text-slate-400">{icon}<span>{label}</span></div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-4 mb-2">{children}</div>;
}

function EmptyState({ msg }) {
  return <div className="bg-[#131c2f] border border-white/5 rounded-2xl p-8 text-center text-slate-400">{msg}</div>;
}

function Badge({ status }) {
  const cls = status === "approved" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : status === "rejected" ? "bg-red-500/15 text-red-400 border-red-500/30"
    : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
  return <span className={`text-[10px] font-bold px-2 py-1 rounded-md border uppercase ${cls}`}>{status}</span>;
}

function DepositCard({ d, busy, onDecide, readOnly }) {
  const [showProof, setShowProof] = useState(false);
  const methodColor = {
    growtopia: "bg-emerald-500/15 text-emerald-400",
    qris: "bg-blue-500/15 text-blue-400",
    dana: "bg-sky-500/15 text-sky-400",
    paypal: "bg-indigo-500/15 text-indigo-400",
  }[d.method] || "bg-slate-500/15 text-slate-400";

  return (
    <div className="bg-[#131c2f] border border-white/5 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${methodColor}`}>{d.method}</span>
            <Badge status={d.status} />
            <span className="text-xs text-slate-500">{new Date(d.created_at).toLocaleString()}</span>
          </div>
          <div className="mt-2 flex items-center gap-4 flex-wrap">
            <div>
              <div className="text-[10px] uppercase text-slate-500">GrowID / User</div>
              <div className="font-mono font-bold">{d.grow_id}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-slate-500">Paid</div>
              <div className="font-bold">{d.amount.toLocaleString()} {d.currency}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-slate-500">Credit</div>
              <div className="font-bold text-emerald-400">+{d.dl_credit.toFixed(2)} DL</div>
            </div>
            {d.reference && (
              <div>
                <div className="text-[10px] uppercase text-slate-500">Ref</div>
                <div className="font-mono text-sm">{d.reference}</div>
              </div>
            )}
          </div>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <button onClick={() => onDecide(d.id, "rejected")} disabled={busy} className="h-10 px-3 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 font-semibold text-sm flex items-center gap-1.5 disabled:opacity-50">
              <XCircle className="w-4 h-4" /> Reject
            </button>
            <button onClick={() => onDecide(d.id, "approved")} disabled={busy} className="h-10 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm flex items-center gap-1.5 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve
            </button>
          </div>
        )}
      </div>
      {d.proof_image && (
        <div className="mt-3">
          <button onClick={() => setShowProof(!showProof)} className="text-xs text-[#3583ff] font-semibold hover:underline">
            {showProof ? "Hide" : "View"} payment proof
          </button>
          {showProof && (
            <div className="mt-2 rounded-xl overflow-hidden border border-white/10 max-w-md">
              <img src={d.proof_image} alt="proof" className="w-full object-contain bg-[#0a0f1e] max-h-96" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CaseCreatorPanel({ growtopiaItems, allCases, onCreated }) {
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [priceBgl, setPriceBgl] = useState("1");
  const [selectedItems, setSelectedItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const addItem = (itemId) => {
    if (!itemId || selectedItems.some((entry) => entry.growtopia_item_id === itemId)) return;
    setSelectedItems((prev) => [...prev, { growtopia_item_id: itemId, probability_percentage: "" }]);
  };

  const updateProbability = (itemId, value) => {
    setSelectedItems((prev) =>
      prev.map((entry) =>
        entry.growtopia_item_id === itemId
          ? { ...entry, probability_percentage: value }
          : entry
      )
    );
  };

  const removeItem = (itemId) => {
    setSelectedItems((prev) => prev.filter((entry) => entry.growtopia_item_id !== itemId));
  };

  const totalProbability = selectedItems.reduce((sum, entry) => sum + Number(entry.probability_percentage || 0), 0);

  const submitCase = async () => {
    if (!name.trim()) return toast.error("Case name is required");
    if (Number(priceBgl) <= 0 || Number(priceBgl) > 400) return toast.error("Case price must be between 0 and 400 BGL");
    if (selectedItems.length === 0) return toast.error("Select at least one Growtopia item");
    if (Math.abs(totalProbability - 100) > 0.0001) return toast.error("Total probability must be exactly 100.0000%");

    setSubmitting(true);
    try {
      await adminApi.createCase({
        name: name.trim(),
        image: image.trim() || null,
        price_bgl: Number(priceBgl),
        items: selectedItems.map((entry) => ({
          growtopia_item_id: entry.growtopia_item_id,
          probability_percentage: Number(entry.probability_percentage),
        })),
      });
      toast.success("Case created");
      setName("");
      setImage("");
      setPriceBgl("1");
      setSelectedItems([]);
      await onCreated();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create case");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#131c2f] border border-white/5 rounded-2xl p-4 space-y-3">
        <h3 className="font-bold">Create New Case</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Case Name" className="bg-[#0e1628] border border-white/10 rounded-lg px-3 h-10 text-sm" />
          <input value={priceBgl} onChange={(e) => setPriceBgl(e.target.value)} placeholder="Case Price (BGL)" type="number" step="0.01" min="0" max="400" className="bg-[#0e1628] border border-white/10 rounded-lg px-3 h-10 text-sm" />
          <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="Case Image URL (optional)" className="bg-[#0e1628] border border-white/10 rounded-lg px-3 h-10 text-sm" />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select onChange={(e) => addItem(e.target.value)} value="" className="bg-[#0e1628] border border-white/10 rounded-lg px-3 h-10 text-sm">
            <option value="">Add Growtopia item...</option>
            {growtopiaItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({Number(item.market_value_bgl || 0).toFixed(2)} BGL)
              </option>
            ))}
          </select>
          <div className={`text-xs font-semibold ${Math.abs(totalProbability - 100) < 0.0001 ? "text-emerald-400" : "text-amber-300"}`}>
            Total probability: {totalProbability.toFixed(4)}%
          </div>
          <button onClick={submitCase} disabled={submitting} className="ml-auto h-10 px-4 rounded-lg bg-[#3583ff] font-semibold disabled:opacity-50">
            {submitting ? "Creating..." : "Create Case"}
          </button>
        </div>
        <div className="space-y-2">
          {selectedItems.map((entry) => {
            const item = growtopiaItems.find((gt) => gt.id === entry.growtopia_item_id);
            if (!item) return null;
            return (
              <div key={entry.growtopia_item_id} className="flex items-center gap-3 bg-[#0e1628] border border-white/10 rounded-lg p-2">
                {item.icon_url ? <img src={item.icon_url} alt={item.name} className="w-9 h-9 rounded object-cover" /> : <div className="w-9 h-9 rounded bg-slate-700" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{item.name}</p>
                  <p className="text-xs text-slate-400">{Number(item.market_value_bgl || 0).toFixed(2)} BGL</p>
                </div>
                <input
                  value={entry.probability_percentage}
                  onChange={(e) => updateProbability(entry.growtopia_item_id, e.target.value)}
                  type="number"
                  step="0.0001"
                  min="0"
                  max="100"
                  placeholder="%"
                  className="w-32 bg-[#111a2e] border border-white/10 rounded-lg px-3 h-9 text-sm"
                />
                <button onClick={() => removeItem(entry.growtopia_item_id)} className="text-xs text-red-400 hover:text-red-300 px-2">Remove</button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-[#131c2f] border border-white/5 rounded-2xl p-4">
        <h3 className="font-bold mb-3">Cases</h3>
        {allCases.length === 0 ? (
          <EmptyState msg="No cases created yet" />
        ) : (
          <div className="space-y-2">
            {allCases.map((caseItem) => (
              <div key={caseItem.id} className="flex items-center justify-between border border-white/10 rounded-lg px-3 py-2">
                <div>
                  <p className="font-semibold">{caseItem.name}</p>
                  <p className="text-xs text-slate-400">{(caseItem.items || []).length} items • {Number(caseItem.price_bgl || 0).toFixed(2)} BGL</p>
                </div>
                <span className={`text-xs font-semibold ${caseItem.is_active ? "text-emerald-400" : "text-slate-400"}`}>{caseItem.is_active ? "ACTIVE" : "INACTIVE"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WithdrawCard({ w, busy, onDecide }) {
  return (
    <div className="bg-[#131c2f] border border-white/5 rounded-2xl p-4 flex items-start justify-between gap-3 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <div className="flex items-center gap-2">
          <Badge status={w.status} />
          <span className="text-xs text-slate-500">{new Date(w.created_at).toLocaleString()}</span>
        </div>
        <div className="mt-2 flex items-center gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase text-slate-500">GrowID</div>
            <div className="font-mono font-bold">{w.grow_id}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-500">Amount</div>
            <div className="font-bold text-orange-400">{w.amount} {w.currency}</div>
          </div>
        </div>
      </div>
      {w.status === "pending" && (
        <div className="flex gap-2">
          <button onClick={() => onDecide(w.id, "rejected")} disabled={busy} className="h-10 px-3 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 font-semibold text-sm flex items-center gap-1.5 disabled:opacity-50">
            <XCircle className="w-4 h-4" /> Reject & Refund
          </button>
          <button onClick={() => onDecide(w.id, "approved")} disabled={busy} className="h-10 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm flex items-center gap-1.5 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Mark Paid
          </button>
        </div>
      )}
    </div>
  );
}
