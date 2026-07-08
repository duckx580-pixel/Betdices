import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { casesApi, logApiError } from "../lib/api";

export default function Cases() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("popularity");

  useEffect(() => {
    (async () => {
      try {
        const data = await casesApi.list(true);
        setCases(data || []);
      } catch (err) {
        logApiError("cases-list", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="pt-2 space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-extrabold">Cases</h1>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-[#0e1628] border border-white/10 rounded-xl px-3 h-10 text-sm"
        >
          <option value="popularity">Popularity</option>
          <option value="price_asc">Price (A-Z)</option>
        </select>
      </div>
      {loading ? (
        <p className="text-slate-400">Loading cases...</p>
      ) : cases.length === 0 ? (
        <p className="text-slate-400">No cases available right now.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...cases]
            .sort((a, b) => {
              if (sortBy === "price_asc") return Number(a.price_bgl || 0) - Number(b.price_bgl || 0);
              const popularityA = Number(a.popularity_score || 0) + Number(a.opens_count || 0);
              const popularityB = Number(b.popularity_score || 0) + Number(b.opens_count || 0);
              return popularityB - popularityA;
            })
            .map((caseItem) => (
            <Link
              to={`/cases/${caseItem.id}`}
              key={caseItem.id}
              className="rounded-2xl bg-gradient-to-b from-[#161f35] to-[#0f1526] border border-white/10 p-4 hover:border-[#3583ff]/40 hover:shadow-[0_12px_30px_rgba(53,131,255,0.16)] transition-all"
            >
              {caseItem.image ? (
                <img
                  src={caseItem.image}
                  alt={caseItem.name}
                  className="w-full h-40 object-cover rounded-xl mb-3"
                />
              ) : (
                <div className="w-full h-40 rounded-xl mb-3 bg-[#0f172a]" />
              )}
              <h2 className="font-bold text-lg">{caseItem.name}</h2>
              <p className="text-slate-300 text-sm mt-1">Price: {Number(caseItem.price_bgl || 0).toFixed(2)} BGL</p>
              <p className="text-slate-400 text-xs mt-1">{(caseItem.items || []).length} possible prizes</p>
              <p className="text-slate-500 text-xs mt-2">Popularity: {Number(caseItem.opens_count || 0)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
