import { useEffect, useRef, useState, useCallback } from "react";
import { triggerFullSync, fetchLogs } from "../api";

const LEVEL_STYLE = {
  success: { color: "#86efac", icon: "✅" },
  error:   { color: "#fca5a5", icon: "❌" },
  warn:    { color: "#fde68a", icon: "⚠️" },
  info:    { color: "#e2e8f0", icon: "›" },
};

export default function ConsolePanel({ onSyncDone }) {
  const [open, setOpen]         = useState(false);
  const [logs, setLogs]         = useState([]);
  const [syncing, setSyncing]   = useState(false);
  const [totalSeen, setTotalSeen] = useState(0);
  const bottomRef               = useRef(null);
  const pollRef                 = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollLogs = useCallback(async () => {
    try {
      const res = await fetchLogs();
      setLogs(res.logs || []);
      setTotalSeen(res.total || 0);
      if (!res.loading && syncing) {
        setSyncing(false);
        stopPolling();
        if (onSyncDone) onSyncDone();
      }
    } catch { /* ignore poll errors */ }
  }, [syncing, stopPolling, onSyncDone]);

  useEffect(() => {
    if (open && !pollRef.current) {
      pollLogs();
      pollRef.current = setInterval(pollLogs, 1000);
    }
    return () => { if (!open) stopPolling(); };
  }, [open, pollLogs, stopPolling]);

  // Auto-scroll xuống dòng mới nhất
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  const handleFullSync = async () => {
    setSyncing(true);
    setOpen(true);
    try {
      await triggerFullSync();
    } catch (e) {
      setSyncing(false);
    }
    // Bắt đầu poll nếu chưa có
    if (!pollRef.current) {
      pollRef.current = setInterval(pollLogs, 1000);
    }
  };

  const handleClear = () => setLogs([]);

  return (
    <>
      {/* Nút trigger */}
      <button onClick={handleFullSync} disabled={syncing}
        title="Kéo toàn bộ dữ liệu từ ClickUp và hiển thị log trực tiếp"
        style={{
          background: syncing ? "#334155" : "#7c3aed",
          border: "none", borderRadius: 8,
          padding: "7px 16px", color: "#fff", fontWeight: 600,
          cursor: syncing ? "wait" : "pointer", fontSize: 13,
          display: "flex", alignItems: "center", gap: 6,
        }}>
        {syncing
          ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> Đang sync...</>
          : "🔃 Làm mới tất cả"}
      </button>

      {/* Toggle console */}
      <button onClick={() => setOpen(o => !o)}
        title="Xem console log"
        style={{
          background: open ? "#1e3a5f" : "#1e293b",
          border: `1px solid ${open ? "#3b82f6" : "#334155"}`,
          borderRadius: 8, padding: "7px 12px", color: open ? "#93c5fd" : "#64748b",
          cursor: "pointer", fontSize: 13, fontWeight: 600,
        }}>
        {open ? "▼ Console" : "▶ Console"}
        {syncing && (
          <span style={{ marginLeft: 6, background: "#ef4444", borderRadius: 99,
            width: 8, height: 8, display: "inline-block", animation: "pulse 1s infinite" }} />
        )}
      </button>

      {/* Console panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
          background: "#0a0f1a", borderTop: "2px solid #3b82f6",
          height: 280, display: "flex", flexDirection: "column",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          boxShadow: "0 -4px 32px #0008",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "6px 16px", borderBottom: "1px solid #1e293b",
            background: "#0f172a", flexShrink: 0,
          }}>
            <span style={{ color: "#3b82f6", fontWeight: 700, fontSize: 13 }}>
              ● CONSOLE
            </span>
            <span style={{ color: "#475569", fontSize: 12 }}>
              {totalSeen} dòng log
            </span>
            {syncing && (
              <span style={{ color: "#fde68a", fontSize: 12, marginLeft: 4 }}>
                ⏳ Đang kéo dữ liệu...
              </span>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={handleClear}
                style={{ background: "none", border: "1px solid #334155", borderRadius: 4,
                  padding: "2px 10px", color: "#64748b", cursor: "pointer", fontSize: 12 }}>
                Xóa
              </button>
              <button onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", color: "#64748b",
                  cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
                ×
              </button>
            </div>
          </div>

          {/* Log entries */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
            {logs.length === 0 && (
              <div style={{ color: "#475569", fontSize: 12, paddingTop: 8 }}>
                Chưa có log. Bấm "🔃 Làm mới tất cả" để bắt đầu.
              </div>
            )}
            {logs.map((entry, i) => {
              const style = LEVEL_STYLE[entry.level] || LEVEL_STYLE.info;
              return (
                <div key={i} style={{
                  display: "flex", gap: 10, fontSize: 12,
                  lineHeight: "20px", color: style.color,
                  borderBottom: "1px solid #0f172a", padding: "1px 0",
                }}>
                  <span style={{ color: "#334155", flexShrink: 0, userSelect: "none" }}>
                    {entry.time}
                  </span>
                  <span style={{ flexShrink: 0, userSelect: "none" }}>{style.icon}</span>
                  <span style={{ wordBreak: "break-word" }}>{entry.message}</span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
      `}</style>
    </>
  );
}
