import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { casesApi, logApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

function ItemIcon({ src, alt, className }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <div className="w-11 h-11 rounded-md bg-slate-800" />;
  return <img src={src} alt={alt} className={className} onError={() => setBroken(true)} />;
}

export default function CaseDetail() {
  const { caseId } = useParams();
  const { refresh } = useAuth();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
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
    return source.sort((a, b) => Number(b.probability_percentage || 0) - Number(a.probability_percentage || 0));
  }, [caseData]);

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
        <p className="text-slate-300 mt-1">Price: {Number(caseData.price_bgl || 0).toFixed(2)} BGL</p>
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
          {openResult.open.item.icon_url ? (
            <img src={openResult.open.item.icon_url} alt={openResult.open.item.name} className="w-14 h-14 rounded-lg object-cover bg-black/40 mt-2" />
          ) : null}
          <p className="font-bold mt-1">{openResult.open.item.name}</p>
          <p className="text-slate-300 text-sm">Value: {Number(openResult.open.item.market_value_bgl || openResult.open.item.value || 0).toFixed(2)} BGL</p>
          <p className="text-slate-300 text-sm">Odds: {Number(openResult.open.item.probability_percentage || 0).toFixed(4)}%</p>
        </div>
      ) : null}

      <div className="rounded-2xl bg-[#131c2f] border border-white/5 p-4">
        <h2 className="font-bold text-lg">Case Contains</h2>
        <div className="mt-4 space-y-2">
          {displayedItems.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0f1728] px-3 py-2">
              {item.icon_url ? (
                <ItemIcon src={item.icon_url} alt={item.name} className="w-11 h-11 rounded-md object-cover bg-black/40" />
              ) : (
                <div className="w-11 h-11 rounded-md bg-slate-800" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{item.name}</p>
                <p className="text-xs text-slate-400">{Number(item.market_value_bgl || item.value || 0).toFixed(2)} BGL</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Chance</p>
                <p className="font-semibold text-[#7cb0ff]">{Number(item.probability_percentage || 0).toFixed(4)}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
