import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Smile } from "lucide-react";
import { chatApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const levelColors = {
  Bronze: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  Silver: "text-slate-300 bg-slate-400/10 border-slate-400/20",
  Gold: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  Platinum: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
  Diamond: "text-blue-300 bg-blue-500/10 border-blue-500/20",
};

function levelClass(level) {
  const key = (level || "").split(" ")[0];
  return levelColors[key] || levelColors.Bronze;
}

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const list = await chatApi.list();
      setMessages(list);
    } catch (e) {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    try {
      await chatApi.send(text);
      load();
    } catch (e) {}
  };

  return (
    <div className="pt-2 h-[calc(100vh-180px)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-extrabold">Chat</h1>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#131c2f] border border-white/5 rounded-2xl p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-10">No messages yet. Be the first!</div>
        )}
        {messages.map((m) => {
          const isMe = m.user_id === user?.id;
          return (
            <div key={m.id} className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
              <img src={m.avatar || `https://i.pravatar.cc/40?u=${m.username}`} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
              <div className={`max-w-[80%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                <div className={`flex items-center gap-2 mb-0.5 ${isMe ? "flex-row-reverse" : ""}`}>
                  <span className="text-sm font-bold">{m.username}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${levelClass(m.level)}`}>{m.level}</span>
                  <span className="text-[10px] text-slate-500">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className={`px-3 py-2 rounded-2xl text-sm break-words ${isMe ? "bg-[#3583ff] text-white rounded-tr-sm" : "bg-[#0a0f1e] border border-white/5 text-slate-100 rounded-tl-sm"}`}>
                  {m.message}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 bg-[#131c2f] border border-white/5 rounded-2xl p-2">
        <button className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
          <Smile className="w-5 h-5 text-slate-400" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message..."
          className="flex-1 h-10 bg-transparent px-2 focus:outline-none text-white placeholder:text-slate-500"
        />
        <button onClick={send} className="w-10 h-10 rounded-xl bg-[#3583ff] hover:bg-[#2872ef] flex items-center justify-center transition-colors shrink-0">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
