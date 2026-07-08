import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { battlesApi, casesApi, logApiError } from "../lib/api";

export default function Battles() {
  const [battles, setBattles] = useState([]);
  const [cases, setCases] = useState([]);
  const [selectedCases, setSelectedCases] = useState([]);
  const [mode, setMode] = useState("normal");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [battleData, caseData] = await Promise.all([battlesApi.list(), casesApi.list(true)]);
      setBattles(battleData || []);
      setCases(caseData || []);
    } catch (err) {
      logApiError("battles-load", err);
      setError(err?.response?.data?.detail || "Failed to load battles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleCase = (id) => {
    setSelectedCases((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const createBattle = async () => {
    setError("");
    if (selectedCases.length === 0) {
      setError("Select at least one case");
      return;
    }
    try {
      await battlesApi.create({ selected_cases: selectedCases, mode });
      setSelectedCases([]);
      await load();
    } catch (err) {
      logApiError("battle-create", err);
      setError(err?.response?.data?.detail || "Failed to create battle");
    }
  };

  return (
    <div className="pt-2 space-y-5 pb-8">
      <h1 className="text-2xl md:text-3xl font-extrabold">Case Battles</h1>

      <div className="rounded-2xl bg-[#131c2f] border border-white/5 p-4 space-y-3">
        <h2 className="font-bold">Create battle</h2>
        <div className="flex flex-wrap gap-2">
          {cases.map((caseItem) => (
            <button
              key={caseItem.id}
              onClick={() => toggleCase(caseItem.id)}
              className={`px-3 h-9 rounded-lg border text-sm ${
                selectedCases.includes(caseItem.id)
                  ? "bg-[#3583ff] border-[#3583ff] text-white"
                  : "bg-[#0e1628] border-white/10 text-slate-300"
              }`}
            >
              {caseItem.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-300">Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="bg-[#0e1628] border border-white/10 rounded-lg px-3 h-9 text-sm"
          >
            <option value="normal">Normal</option>
            <option value="jackpot">Jackpot</option>
          </select>
          <button onClick={createBattle} className="ml-auto h-9 px-4 rounded-lg bg-[#3583ff] font-semibold">
            Create
          </button>
        </div>
        {error ? <p className="text-red-400 text-sm">{error}</p> : null}
      </div>

      <div className="rounded-2xl bg-[#131c2f] border border-white/5 p-4">
        <h2 className="font-bold mb-3">Open battles</h2>
        {loading ? (
          <p className="text-slate-400">Loading...</p>
        ) : battles.length === 0 ? (
          <p className="text-slate-400">No battles yet.</p>
        ) : (
          <div className="space-y-2">
            {battles.map((battle) => (
              <Link
                key={battle.id}
                to={`/battles/${battle.id}`}
                className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 hover:border-[#3583ff]/40"
              >
                <div>
                  <p className="font-semibold">Battle #{battle.id.slice(0, 8)}</p>
                  <p className="text-xs text-slate-400">
                    {battle.players?.length || 0} players • {battle.selected_cases?.length || 0} rounds • {battle.mode}
                  </p>
                </div>
                <span className="text-xs uppercase text-slate-300">{battle.battle_status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
