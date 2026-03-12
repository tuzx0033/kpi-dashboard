export default function StatCard({ icon, label, value, sub, color = "#3b82f6", loading }) {
  return (
    <div style={{
      background: "#1e293b",
      border: `1px solid #334155`,
      borderRadius: 12,
      padding: "20px 24px",
      display: "flex",
      alignItems: "center",
      gap: 16,
      flex: "1 1 180px",
      minWidth: 180,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: color + "22",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>
          {loading ? <span style={{ fontSize: 16, color: "#64748b" }}>...</span> : value}
        </div>
        {sub && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  );
}
