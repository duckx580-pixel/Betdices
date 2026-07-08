import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { battlesApi, WS_BASE, logApiError } from "../lib/api";

const formatEvent = (log) => {
  if (log.event_type === "PlayerJoined") return `${log.event_payload?.username || "Player"} joined the battle`;
  if (log.event_type === "RoundResult") return `Round ${log.event_payload?.round} completed`;
  if (log.event_type === "BattleWinner") return `${log.event_payload?.winner_username || "Player"} won the battle`;
  if (log.event_type === "BattleStarted") return "Battle started";
  if (log.event_type === "BattleCreated") return "Battle created";
  return log.event_type;
};

export default function BattleRoom() {
  const { battleId } = useParams();
  const [battle, setBattle] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [battleData, logData] = await Promise.all([battlesApi.get(battleId), battlesApi.logs(battleId)]);
      setBattle(battleData);
      setLogs(logData || []);
    } catch (err) {
      logApiError("battle-room-load", err);
      setError(err?.response?.data?.detail || "Failed to load battle");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [battleId]);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/battles/${battleId}`);
    ws.onmessage = async () => {
      await load();
    };
    ws.onerror = () => {
      setError((prev) => prev || "Live updates disconnected. Showing history fallback.");
    };
    return () => ws.close();
  }, [battleId]);

  const sortedTotals = useMemo(() => {
    if (!battle?.totals_by_player || !battle?.players) return [];
    return [...battle.players]
      .map((player) => ({
        ...player,
        total: Number(battle.totals_by_player[player.user_id] || 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [battle]);

  const join = async () => {
    await battlesApi.join(battleId);
    await load();
  };
  const start = async () => {
    await battlesApi.start(battleId);
    await load();
  };
  const nextRound = async () => {
    await battlesApi.nextRound(battleId);
    await load();
  };

  if (loading) return <p className="pt-2 text-slate-400">Loading battle...</p>;
  if (!battle) return <p className="pt-2 text-slate-400">{error || "Battle not found."}</p>;

  return (
    <div className="pt-2 space-y-4 pb-8">
      <div className="rounded-2xl bg-[#131c2f] border border-white/5 p-4">
        <h1 className="text-2xl font-extrabold">Battle #{battle.id.slice(0, 8)}</h1>
        <p className="text-slate-300 text-sm mt-1">
          Mode: {battle.mode} • Status: {battle.battle_status} • Round {battle.current_round}/{battle.selected_cases?.length || 0}
        </p>
        <div className="flex gap-2 mt-4 flex-wrap">
          <button onClick={join} className="h-9 px-4 rounded-lg bg-[#20314d] text-sm font-semibold">Join</button>
          <button onClick={start} className="h-9 px-4 rounded-lg bg-[#3583ff] text-sm font-semibold">Start</button>
          <button onClick={nextRound} className="h-9 px-4 rounded-lg bg-[#16a34a] text-sm font-semibold">Play Next Round</button>
        </div>
        {battle.winner_user_id ? (
          <p className="text-emerald-300 text-sm mt-3">Winner user id: {battle.winner_user_id}</p>
        ) : null}
        {error ? <p className="text-amber-300 text-xs mt-2">{error}</p> : null}
      </div>

      <div className="rounded-2xl bg-[#131c2f] border border-white/5 p-4">
        <h2 className="font-bold mb-2">Leaderboard</h2>
        <div className="space-y-2">
          {sortedTotals.map((row) => (
            <div key={row.user_id} className="flex items-center justify-between border border-white/10 rounded-lg px-3 py-2">
              <span>{row.username}</span>
              <span className="text-slate-300">{row.total.toFixed(2)} DL</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-[#131c2f] border border-white/5 p-4">
        <h2 className="font-bold mb-2">Battle history</h2>
        <div className="space-y-2 max-h-80 overflow-auto pr-1">
          {logs.map((log) => (
            <div key={log.id} className="border border-white/10 rounded-lg px-3 py-2">
              <p className="text-sm">{formatEvent(log)}</p>
              <p className="text-xs text-slate-400">{new Date(log.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
