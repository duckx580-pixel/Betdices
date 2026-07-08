import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { casesApi, logApiError } from "../lib/api";

export default function Cases() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

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
    <div className="pt-2 space-y-4">
      <h1 className="text-2xl md:text-3xl font-extrabold">Cases</h1>
      {loading ? (
        <p className="text-slate-400">Loading cases...</p>
      ) : cases.length === 0 ? (
        <p className="text-slate-400">No cases available right now.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cases.map((caseItem) => (
            <Link
              to={`/cases/${caseItem.id}`}
              key={caseItem.id}
              className="rounded-2xl bg-[#131c2f] border border-white/5 p-4 hover:border-[#3583ff]/40 transition-colors"
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
              <p className="text-slate-300 text-sm mt-1">Price: {Number(caseItem.price_dl || 0).toFixed(2)} DL</p>
              <p className="text-slate-400 text-xs mt-1">{(caseItem.items || []).length} possible prizes</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
