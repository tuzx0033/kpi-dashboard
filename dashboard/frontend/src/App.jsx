import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { fetchStats, fetchKpiByAssignee, fetchTasks, fetchCompliance, triggerRefresh, triggerFullSync } from "./api";
import StatCard from "./components/StatCard";
import KpiTable from "./components/KpiTable";
import TaskTable from "./components/TaskTable";
import CompliancePanel from "./components/CompliancePanel";
import DocsPanel from "./components/DocsPanel";

const PIE_COLORS = ["#3b82f6","#22c55e","#f59e0b","#ef4444","#a78bfa","#06b6d4","#f97316","#ec4899","#84cc16","#64748b"];

const TF_LABELS = { "1.0": "Đúng hạn", "0.9": "Trễ 1-2 ngày", "0.8": "Trễ 3-5 ngày", "0.6": "Trễ >5 ngày" };
const TF_COLORS = { "1.0": "#22c55e", "0.9": "#f59e0b", "0.8": "#f97316", "0.6": "#ef4444" };

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#94a3b8", marginBottom: 14,
        textTransform: "uppercase", letterSpacing: 1 }}>{title}</h2>
      {children}
    </section>
  );
}

export default function App() {
  const [stats, setStats]           = useState(null);
  const [kpi, setKpi]               = useState([]);
  const [tasks, setTasks]           = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [fullSyncing, setFullSyncing] = useState(false);
  const [error, setError]             = useState(null);
  const [lastFetch, setLastFetch]   = useState(null);
  const [activeTab, setActiveTab]   = useState("overview"); // overview | compliance | tasks

  // Tải toàn bộ dữ liệu từ cache của Go server
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, k, t, c] = await Promise.all([
        fetchStats(),
        fetchKpiByAssignee(),
        fetchTasks(),
        fetchCompliance(),
      ]);
      setStats(s);
      setKpi(k);
      setTasks(t.tasks || []);
      setCompliance(c);
      setLastFetch(s.fetched_at || "");
    } catch (e) {
      setError(`Không kết nối được Go server tại: ${import.meta.env.VITE_API_URL || "http://localhost:8080 (chưa set VITE_API_URL)"}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Nút Làm mới: trigger Go server fetch lại tuần này, rồi poll đến khi xong
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await triggerRefresh();
      // Poll mỗi 3s cho đến khi server báo loading=false
      const poll = setInterval(async () => {
        try {
          const [s, k, t, c] = await Promise.all([
            fetchStats(), fetchKpiByAssignee(), fetchTasks(), fetchCompliance(),
          ]);
          if (!t.loading) {
            clearInterval(poll);
            setStats(s); setKpi(k); setTasks(t.tasks || []); setCompliance(c);
            setLastFetch(s.fetched_at || "");
            setRefreshing(false);
          }
        } catch { clearInterval(poll); setRefreshing(false); }
      }, 3000);
    } catch (e) {
      setError("Không thể kết nối server để làm mới");
      setRefreshing(false);
    }
  }, []);

  // Nút Làm mới toàn thời gian: kéo TẤT CẢ tasks từ ClickUp → lưu DB → cập nhật cache
  const handleFullSync = useCallback(async () => {
    if (!window.confirm("Full sync sẽ kéo toàn bộ lịch sử tasks từ ClickUp, có thể mất vài phút. Tiếp tục?")) return;
    setFullSyncing(true);
    setError(null);
    try {
      await triggerFullSync();
      // Poll mỗi 5s cho đến khi server báo loading=false
      const poll = setInterval(async () => {
        try {
          const [s, k, t, c] = await Promise.all([
            fetchStats(), fetchKpiByAssignee(), fetchTasks(), fetchCompliance(),
          ]);
          if (!t.loading) {
            clearInterval(poll);
            setStats(s); setKpi(k); setTasks(t.tasks || []); setCompliance(c);
            setLastFetch(s.fetched_at || "");
            setFullSyncing(false);
          }
        } catch { clearInterval(poll); setFullSyncing(false); }
      }, 5000);
    } catch (e) {
      setError("Không thể kết nối server để full sync");
      setFullSyncing(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  // --- Chart data ---
  const statusData = stats
    ? Object.entries(stats.status_dist || {}).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    : [];

  const tfData = stats
    ? Object.entries(stats.time_factor_dist || {}).map(([tf, count]) => ({
        name: TF_LABELS[tf] || tf, value: count, color: TF_COLORS[tf] || "#64748b"
      }))
    : [];

  const kpiBarData = kpi
    .filter(p => p.kpi_pct != null)
    .map(p => ({ name: p.assignee, kpi: p.kpi_pct, dhs: p.dhs }));

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a" }}>
      {/* ── Header ── */}
      <header style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "0 32px",
        display: "flex", alignItems: "center", gap: 16, height: 60, position: "sticky", top: 0, zIndex: 100 }}>
        <span style={{ fontSize: 22, marginRight: 4 }}>📊</span>
        <span style={{ fontWeight: 800, fontSize: 18, color: "#f1f5f9" }}>ClickUp KPI Dashboard</span>
        <span style={{ fontSize: 12, color: "#64748b", marginLeft: 4 }}>v3.1</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {/* Tab navigation */}
          {[
            { id: "overview",   label: "📊 Tổng quan" },
            { id: "compliance", label: `🔍 Kiểm tra dữ liệu${compliance ? ` (${compliance.tasks_with_issues})` : ""}` },
            { id: "tasks",      label: "📋 Tasks" },
            { id: "docs",       label: "📖 Tài liệu KPI" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ background: activeTab === tab.id ? "#3b82f6" : "transparent",
                border: activeTab === tab.id ? "none" : "1px solid #334155",
                borderRadius: 8, padding: "6px 14px", color: activeTab === tab.id ? "#fff" : "#94a3b8",
                fontWeight: activeTab === tab.id ? 700 : 400, cursor: "pointer", fontSize: 13 }}>
              {tab.label}
            </button>
          ))}

          <div style={{ width: 1, height: 24, background: "#334155", margin: "0 4px" }} />

          {stats?.week_label && (
            <span style={{ background: "#1d4ed822", border: "1px solid #3b82f644",
              borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "#93c5fd", fontWeight: 600 }}>
              📅 {stats.week_label}
            </span>
          )}
          {lastFetch && (
            <span style={{ fontSize: 12, color: "#475569" }}>Cập nhật: {lastFetch}</span>
          )}
          <button onClick={handleRefresh} disabled={refreshing || fullSyncing}
            style={{ background: refreshing ? "#334155" : "#3b82f6", border: "none", borderRadius: 8,
              padding: "7px 18px", color: "#fff", fontWeight: 600,
              cursor: (refreshing || fullSyncing) ? "wait" : "pointer",
              fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            {refreshing ? "⏳ Đang tải..." : "🔄 Làm mới"}
          </button>
          <button onClick={handleFullSync} disabled={fullSyncing || refreshing}
            title="Kéo toàn bộ lịch sử tasks từ ClickUp về DB (mất vài phút)"
            style={{ background: fullSyncing ? "#334155" : "#7c3aed", border: "none", borderRadius: 8,
              padding: "7px 18px", color: "#fff", fontWeight: 600,
              cursor: (fullSyncing || refreshing) ? "wait" : "pointer",
              fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            {fullSyncing ? "⏳ Đang sync..." : "🗄️ Sync toàn thời gian"}
          </button>
        </div>
      </header>

      <main style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>
        {error && (
          <div style={{ background: "#7f1d1d", border: "1px solid #ef4444", borderRadius: 10,
            padding: "14px 20px", marginBottom: 24, color: "#fca5a5" }}>⚠️ {error}</div>
        )}

        {/* ── TAB: DOCS ── */}
        {activeTab === "docs" && (
          <Section title="Tài liệu KPI — QUY_DINH_TINH_DIEM_KPI v3.1">
            <DocsPanel />
          </Section>
        )}

        {/* ── TAB: COMPLIANCE ── */}
        {activeTab === "compliance" && (
          <Section title="Kiểm tra dữ liệu theo QUY_DINH_TINH_DIEM_KPI v3.1">
            <CompliancePanel data={compliance} loading={loading} />
          </Section>
        )}

        {/* ── TAB: TASKS ── */}
        {activeTab === "tasks" && (
          <Section title="Chi tiết tasks">
            <TaskTable tasks={tasks} loading={loading} />
          </Section>
        )}

        {/* ── TAB: OVERVIEW ── */}
        {activeTab === "overview" && <>

        {/* ── Stat Cards ── */}
        <Section title="Tổng quan">
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <StatCard icon="📋" label="Tổng Tasks" value={stats?.total_tasks ?? "—"} color="#3b82f6" loading={loading} />
            <StatCard icon="✅" label="Tasks Closed" value={stats?.total_closed ?? "—"} color="#22c55e" loading={loading} />
            <StatCard icon="🎯" label="Tasks có điểm" value={stats?.total_scored ?? "—"}
              sub={stats ? `${Math.round(stats.total_scored / stats.total_tasks * 100)}% tổng số` : ""}
              color="#a78bfa" loading={loading} />
            <StatCard icon="⏱️" label="Đúng hạn" value={stats ? `${stats.on_time_rate}%` : "—"}
              sub={stats ? `${stats.on_time_count} / ${stats.on_time_count + stats.late_count} closed tasks` : ""}
              color="#06b6d4" loading={loading} />
            <StatCard icon="🏅" label="KPI% Team" value={stats?.team_kpi_pct != null ? `${stats.team_kpi_pct}%` : "—"}
              color={stats?.team_kpi_pct >= 100 ? "#22c55e" : stats?.team_kpi_pct >= 80 ? "#f59e0b" : "#ef4444"}
              loading={loading} />
          </div>
        </Section>

        {/* ── Charts row ── */}
        <Section title="Biểu đồ">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>

            {/* KPI% per person */}
            <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, color: "#e2e8f0" }}>📈 KPI% theo thành viên</div>
              {kpiBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={kpiBarData} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} unit="%" domain={[0, 130]} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                      formatter={(v) => [`${v}%`, "KPI%"]} />
                    <Bar dataKey="kpi" radius={[4, 4, 0, 0]}>
                      {kpiBarData.map((d, i) => (
                        <Cell key={i} fill={d.kpi >= 100 ? "#22c55e" : d.kpi >= 80 ? "#f59e0b" : "#ef4444"} />
                      ))}
                    </Bar>
                    {/* Reference line 100% */}
                    <CartesianGrid y={100} stroke="#3b82f6" strokeDasharray="6 3" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ color: "#64748b", textAlign: "center", padding: 40 }}>{loading ? "Đang tải..." : "Chưa có dữ liệu KPI"}</div>}
            </div>

            {/* Status pie */}
            <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, color: "#e2e8f0" }}>🍩 Phân bổ Status</div>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={90}
                      dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}>
                      {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ color: "#64748b", textAlign: "center", padding: 40 }}>{loading ? "Đang tải..." : "Chưa có dữ liệu"}</div>}
            </div>

            {/* TimeFactor bar */}
            <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, color: "#e2e8f0" }}>⏰ Phân bổ đúng hạn / trễ</div>
              {tfData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={tfData} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {tfData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ color: "#64748b", textAlign: "center", padding: 40 }}>{loading ? "Đang tải..." : "Chưa có dữ liệu"}</div>}
            </div>

          </div>
        </Section>

        {/* ── KPI by person table ── */}
        <Section title="KPI cá nhân">
          <KpiTable data={kpi} loading={loading} />
        </Section>

        </> /* end overview tab */ }
      </main>
    </div>
  );
}
