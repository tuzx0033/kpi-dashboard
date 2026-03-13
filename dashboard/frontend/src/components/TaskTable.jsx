import { useState, useMemo } from "react";
import { fetchAllTasks } from "../api";
import { exportTasksToExcel } from "../utils/exportExcel";

const STATUS_COLOR = {
  closed: "#22c55e", "in progress": "#3b82f6", open: "#94a3b8",
  pending: "#f59e0b", blocked: "#ef4444", completed: "#22c55e",
  "in review": "#a78bfa", "hoàn thành chờ build": "#06b6d4",
};

function scoreColor(score, weight) {
  if (!score || !weight) return "#64748b";
  const r = score / weight;
  if (score === 0) return "#ef4444";
  if (r >= 0.9) return "#22c55e";
  if (r >= 0.7) return "#f59e0b";
  return "#ef4444";
}

function tfBadge(tf) {
  const map = { 1: ["✅", "#22c55e"], 0.9: ["⚠️", "#f59e0b"], 0.8: ["🔴", "#f97316"], 0.6: ["❌", "#ef4444"] };
  const [icon, color] = map[tf] ?? ["—", "#64748b"];
  return <span style={{ color, fontWeight: 600 }}>{icon} {tf}</span>;
}

export default function TaskTable({ tasks, loading }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const PAGE_SIZE = 20;

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetchAllTasks();
      const allTasks = res.tasks || [];
      const now = new Date().toISOString().slice(0, 10);
      exportTasksToExcel(allTasks, `KPI_Tasks_All_${now}.xlsx`);
    } catch (e) {
      alert("Không thể tải dữ liệu để xuất Excel: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  const statuses = useMemo(() => {
    const s = new Set((tasks || []).map(t => t.status).filter(Boolean));
    return ["all", ...s];
  }, [tasks]);

  const filtered = useMemo(() => {
    return (tasks || []).filter(t => {
      const q = search.toLowerCase();
      const matchSearch = !q || t.name?.toLowerCase().includes(q) || (t.assignees || []).join(" ").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tasks, search, statusFilter]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, overflow: "hidden" }}>
      {/* Header + filters */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #334155", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600, fontSize: 15, marginRight: "auto" }}>📋 Danh sách Tasks ({filtered.length})</span>
        <button onClick={handleExport} disabled={exporting}
          style={{ background: exporting ? "#334155" : "#16a34a", border: "none", borderRadius: 8,
            padding: "6px 16px", color: "#fff", fontWeight: 600, cursor: exporting ? "wait" : "pointer",
            fontSize: 13, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          {exporting ? "⏳ Đang xuất..." : "📥 Xuất Excel (toàn thời gian)"}
        </button>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="🔍 Tìm task, assignee..."
          style={{ background: "#0f172a", border: "1px solid #475569", borderRadius: 8, padding: "6px 12px",
            color: "#e2e8f0", fontSize: 13, width: 220 }} />
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          style={{ background: "#0f172a", border: "1px solid #475569", borderRadius: 8, padding: "6px 12px",
            color: "#e2e8f0", fontSize: 13 }}>
          {statuses.map(s => <option key={s} value={s}>{s === "all" ? "Tất cả status" : s}</option>)}
        </select>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#0f172a" }}>
              {["Tên task", "Assignee", "Status", "Due date", "Closed", "Weight", "TimeFactor", "Quality", "Score"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "#94a3b8",
                  fontWeight: 600, whiteSpace: "nowrap", borderBottom: "1px solid #334155" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: "#64748b" }}>Đang tải...</td></tr>}
            {!loading && paged.map((t, i) => (
              <tr key={t.id + i} style={{ background: i % 2 === 0 ? "transparent" : "#0f172a33",
                borderBottom: "1px solid #1e293b" }}>
                <td style={{ padding: "8px 12px", maxWidth: 280 }}>
                  <a href={t.url} target="_blank" rel="noreferrer"
                    style={{ color: "#93c5fd", textDecoration: "none" }}
                    title={t.name}>{t.name?.length > 60 ? t.name.slice(0, 60) + "…" : t.name}</a>
                </td>
                <td style={{ padding: "8px 12px", color: "#c4b5fd", whiteSpace: "nowrap" }}>
                  {(t.assignees || []).join(", ") || "—"}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  <span style={{
                    background: (STATUS_COLOR[t.status?.toLowerCase()] ?? "#475569") + "33",
                    color: STATUS_COLOR[t.status?.toLowerCase()] ?? "#94a3b8",
                    padding: "2px 8px", borderRadius: 99, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap"
                  }}>{t.status}</span>
                </td>
                <td style={{ padding: "8px 12px", color: "#94a3b8", whiteSpace: "nowrap" }}>
                  {t.due_date ? t.due_date.slice(0, 10) : "—"}
                </td>
                <td style={{ padding: "8px 12px", color: "#94a3b8", whiteSpace: "nowrap" }}>
                  {t.date_closed ? t.date_closed.slice(0, 10) : "—"}
                </td>
                <td style={{ padding: "8px 12px", color: "#fbbf24", fontWeight: 600 }}>
                  {t.kpi_weight ?? "—"}
                </td>
                <td style={{ padding: "8px 12px" }}>{tfBadge(t.kpi_time_factor)}</td>
                <td style={{ padding: "8px 12px", color: "#a78bfa", textTransform: "capitalize" }}>
                  {t.kpi_quality_label || <span style={{ color: "#475569" }}>unset</span>}
                </td>
                <td style={{ padding: "8px 12px", fontWeight: 700,
                  color: scoreColor(t.kpi_score, t.kpi_weight) }}>
                  {t.kpi_score != null ? t.kpi_score : "—"}
                </td>
              </tr>
            ))}
            {!loading && paged.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: "#64748b" }}>Không có task nào</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ padding: "12px 20px", borderTop: "1px solid #334155", display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
          <span style={{ color: "#64748b", fontSize: 13, marginRight: "auto" }}>
            Trang {page + 1} / {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ background: "#334155", border: "none", borderRadius: 6, padding: "5px 14px", color: "#e2e8f0",
              cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.4 : 1 }}>‹</button>
          {Array.from({ length: totalPages }, (_, i) => i)
            .filter(i => Math.abs(i - page) <= 2)
            .map(i => (
              <button key={i} onClick={() => setPage(i)}
                style={{ background: i === page ? "#3b82f6" : "#334155", border: "none", borderRadius: 6,
                  padding: "5px 12px", color: "#e2e8f0", cursor: "pointer", fontWeight: i === page ? 700 : 400 }}>
                {i + 1}
              </button>
            ))}
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
            style={{ background: "#334155", border: "none", borderRadius: 6, padding: "5px 14px", color: "#e2e8f0",
              cursor: page === totalPages - 1 ? "not-allowed" : "pointer", opacity: page === totalPages - 1 ? 0.4 : 1 }}>›</button>
        </div>
      )}
    </div>
  );
}
