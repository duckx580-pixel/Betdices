import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { casesApi, logApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const rarityOf = (probability) => {
  if (probability <= 1) return "Legendary";
  if (probability <= 5) return "Epic";
  if (probability <= 15) return "Rare";
  return "Common";
};

export default function CaseDetail() {
  const { caseId } = useParams();
  const { refresh } = useAuth();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("value_desc");
  const [rarity, setRarity] = useState("all");
  const [openResult, setOpenResult] = useState(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await casesApi.get(caseId);
        setCaseData(data);
      } catch (err) {
        logApiError("case-detail", err);
        setError(err?.response?.data?.detail || "Failed to load case");
      } finally {
        setLoading(false);
      }
    })();
  }, [caseId]);

  const displayedItems = useMemo(() => {
    const source = [...(caseData?.items || [])];
    const filtered = rarity === "all" ? source : source.filter((item) => rarityOf(Number(item.probability_percentage || 0)) === rarity);
    if (sortBy === "value_asc") return filtered.sort((a, b) => Number(a.value || 0) - Number(b.value || 0));
    if (sortBy === "value_desc") return filtered.sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
    if (sortBy === "odds_asc") return filtered.sort((a, b) => Number(a.probability_percentage || 0) - Number(b.probability_percentage || 0));
    return filtered.sort((a, b) => Number(b.probability_percentage || 0) - Number(a.probability_percentage || 0));
  }, [caseData, sortBy, rarity]);

  const openCase = async () => {
    setOpening(true);
    setError("");
    try {
      const data = await casesApi.open(caseId);
      setOpenResult(data);
      await refresh();
    } catch (err) {
      logApiError("case-open", err);
      setError(err?.response?.data?.detail || "Failed to open case");
    } finally {
      setOpening(false);
    }
  };

  if (loading) return <p className="pt-2 text-slate-400">Loading case...</p>;
  if (!caseData) return <p className="pt-2 text-slate-400">{error || "Case not found."}</p>;

  return (
    <div className="pt-2 space-y-4 pb-8">
      <div className="rounded-2xl bg-[#131c2f] border border-white/5 p-4">
        {caseData.image ? (
          <img src={caseData.image} alt={caseData.name} className="w-full max-h-64 object-cover rounded-xl mb-3" />
        ) : null}
        <h1 className="text-2xl font-extrabold">{caseData.name}</h1>
        <p className="text-slate-300 mt-1">Price: {Number(caseData.price_dl || 0).toFixed(2)} DL</p>
        <button
          onClick={openCase}
          disabled={opening}
          className="mt-4 h-11 px-5 rounded-xl bg-[#3583ff] hover:bg-[#2f73df] disabled:opacity-60 font-semibold"
        >
          {opening ? "Opening..." : "Open Case"}
        </button>
        {error ? <p className="text-red-400 text-sm mt-2">{error}</p> : null}
      </div>

      {openResult?.open ? (
        <div className="rounded-2xl bg-[#10222d] border border-emerald-500/25 p-4">
          <p className="text-xs uppercase tracking-wider text-emerald-300">Latest result</p>
          <p className="font-bold mt-1">{openResult.open.item.name}</p>
          <p className="text-slate-300 text-sm">Value: {Number(openResult.open.item.value || 0).toFixed(2)} DL</p>
          <p className="text-slate-300 text-sm">Odds: {Number(openResult.open.item.probability_percentage || 0).toFixed(2)}%</p>
        </div>
      ) : null}

      <div className="rounded-2xl bg-[#131c2f] border border-white/5 p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <h2 className="font-bold text-lg">Potential prizes</h2>
          <div className="flex gap-2 flex-wrap">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#0e1628] border border-white/10 rounded-lg px-3 h-9 text-sm"
            >
              <option value="value_desc">Value: High → Low</option>
              <option value="value_asc">Value: Low → High</option>
              <option value="odds_desc">Odds: High → Low</option>
              <option value="odds_asc">Odds: Low → High</option>
            </select>
            <select
              value={rarity}
              onChange={(e) => setRarity(e.target.value)}
              className="bg-[#0e1628] border border-white/10 rounded-lg px-3 h-9 text-sm"
            >
              <option value="all">All rarity</option>
              <option value="Legendary">Legendary</option>
              <option value="Epic">Epic</option>
              <option value="Rare">Rare</option>
              <option value="Common">Common</option>
            </select>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400">
              <tr className="border-b border-white/10">
                <th className="text-left py-2">Item</th>
                <th className="text-left py-2">Rarity</th>
                <th className="text-right py-2">Value (DL)</th>
                <th className="text-right py-2">Odds</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((item) => (
                <tr key={item.id} className="border-b border-white/5">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2">{rarityOf(Number(item.probability_percentage || 0))}</td>
                  <td className="py-2 text-right">{Number(item.value || 0).toFixed(2)}</td>
                  <td className="py-2 text-right">{Number(item.probability_percentage || 0).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
