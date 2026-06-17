import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";

const LANE_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b"];
const STATUS_COLORS = { healthy: "#10b981", degraded: "#d97706", critical: "#ef4444" };
const SIGNAL_COLORS = { green: "#10b981", yellow: "#facc15", red: "#ef4444" };

function createEmptyModeStats() {
  return {
    samples: 0,
    waitTotal: 0,
    queueTotal: 0,
    vehiclesTotal: 0,
  };
}

function getModeStats(comparisonStats, mode) {
  const stats = comparisonStats[mode] ?? createEmptyModeStats();
  return {
    samples: stats.samples,
    avgWait: stats.samples ? (stats.waitTotal / stats.samples).toFixed(1) : "0.0",
    avgQueue: stats.samples ? (stats.queueTotal / stats.samples).toFixed(1) : "0.0",
    avgVehicles: stats.samples ? (stats.vehiclesTotal / stats.samples).toFixed(1) : "0.0",
  };
}

export default function Dashboard({ apiBase, health, sim, error }) {
  const [history, setHistory] = useState([]);
  const [comparisonStats, setComparisonStats] = useState({
    smart: createEmptyModeStats(),
    fixed: createEmptyModeStats(),
  });

  useEffect(() => {
    if (!sim) return;

    const mode = sim.config?.controller_mode ?? sim.prediction?.controller ?? "smart";
    const totalQueue = sim.lanes
      ? sim.lanes.reduce((a, l) => a + l.queue_length, 0)
      : 0;
    const avgWaitSample = sim.lanes
      ? sim.lanes.reduce((a, l) => a + l.waiting_time, 0) / Math.max(sim.lanes.length, 1)
      : 0;
    const totalVehiclesSample = sim.lanes
      ? sim.lanes.reduce((a, l) => a + l.vehicle_count, 0)
      : 0;

    setHistory((prev) => {
      const next = [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          controller_mode: mode,
          ...Object.fromEntries(
            (sim.lanes ?? []).map((l) => [`lane_${l.lane_id}_queue`, l.queue_length])
          ),
          avg_wait: avgWaitSample.toFixed(1),
          total_queue: totalQueue.toFixed(1),
          total_vehicles: totalVehiclesSample,
        },
      ];
      return next.slice(-120);
    });

    setComparisonStats((prev) => ({
      ...prev,
      [mode]: {
        samples: (prev[mode]?.samples ?? 0) + 1,
        waitTotal: (prev[mode]?.waitTotal ?? 0) + avgWaitSample,
        queueTotal: (prev[mode]?.queueTotal ?? 0) + totalQueue,
        vehiclesTotal: (prev[mode]?.vehiclesTotal ?? 0) + totalVehiclesSample,
      },
    }));
  }, [sim]);

  // ---- Derived data ----
  const lanes = sim?.lanes ?? [];
  const barData = lanes.map((l) => ({
    name: l.direction,
    "Queue Length": l.queue_length,
    "Waiting Time (s)": l.waiting_time,
    "Vehicles": l.vehicle_count,
    isGreen: l.is_green,
  }));

  const totalVehicles = lanes.reduce((a, l) => a + l.vehicle_count, 0);
  const avgWait = lanes.length
    ? (lanes.reduce((a, l) => a + l.waiting_time, 0) / lanes.length).toFixed(1)
    : 0;
  const greenLanes = lanes.filter((l) => l.is_green).length;
  const smartStats = getModeStats(comparisonStats, "smart");
  const fixedStats = getModeStats(comparisonStats, "fixed");
  const activeMode = sim?.config?.controller_mode ?? "smart";

  const status = health?.model_loaded ? "healthy" : totalVehicles > 30 ? "critical" : "degraded";

  return (
    <div style={styles.container}>
      {/* Error banner */}
      {error && <div style={styles.error}>Cannot reach backend API at {apiBase}</div>}

      {/* Stat cards */}
      <div style={styles.cardsRow}>
        <Card
          label="Model Status"
          value={health?.model_loaded ? "Loaded" : "N/A"}
          color={health?.model_loaded ? STATUS_COLORS.healthy : STATUS_COLORS.critical}
          sub={health?.metrics ? `Final Avg Reward: ${health.metrics.final_avg_reward}` : ""}
        />
        <Card
          label="Total Vehicles"
          value={totalVehicles}
          color={STATUS_COLORS[status]}
          sub="At intersection"
        />
        <Card
          label="Avg Waiting Time"
          value={`${avgWait}s`}
          color={totalVehicles > 20 ? STATUS_COLORS.critical : STATUS_COLORS.degraded}
          sub="Across all lanes"
        />
        <Card
          label="Green Phases"
          value={`${greenLanes}/4`}
          color={greenLanes > 0 ? STATUS_COLORS.healthy : STATUS_COLORS.critical}
          sub="Active lanes"
        />
      </div>

      <div style={styles.compareGrid}>
        <CompareCard
          title="Smart ML-Assisted"
          active={activeMode === "smart"}
          stats={smartStats}
        />
        <CompareCard
          title="No-ML Fixed Cycle"
          active={activeMode === "fixed"}
          stats={fixedStats}
        />
      </div>

      {/* Queue & Wait Chart */}
      <div style={styles.chartRow}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Lane Queue Lengths & Waiting Times</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barCategoryGap="20%">
              <XAxis dataKey="name" stroke="#6b7280" tick={{ fill: "#6b7280", fontSize: 12 }} />
              <YAxis stroke="#6b7280" tick={{ fill: "#6b7280", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  color: "#1f2937",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
                }}
              />
              <Bar dataKey="Queue Length" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Waiting Time (s)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Vehicles" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Live history chart */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Traffic History (last 30 samples)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={history.slice(-30)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="time" stroke="#6b7280" tick={{ fill: "#6b7280", fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis stroke="#6b7280" tick={{ fill: "#6b7280", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  color: "#1f2937",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {[0, 1, 2, 3].map((i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`lane_${i}_queue`}
                  stroke={LANE_COLORS[i]}
                  strokeWidth={2}
                  dot={false}
                  name={`Lane ${i}`}
                />
              ))}
              <Line
                type="monotone"
                dataKey="avg_wait"
                stroke="#ffd200"
                strokeWidth={2}
                dot={false}
                strokeDasharray="4 2"
                name="Avg Wait"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lane detail table */}
      <div style={styles.tableCard}>
        <h3 style={styles.chartTitle}>Live Lane Details</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Lane</th>
                <th style={styles.th}>Direction</th>
                <th style={styles.th}>Queue</th>
                <th style={styles.th}>Wait (s)</th>
                <th style={styles.th}>Countdown</th>
                <th style={styles.th}>Vehicles</th>
                <th style={styles.th}>Speed (km/h)</th>
                <th style={styles.th}>Phase</th>
              </tr>
            </thead>
            <tbody>
              {lanes.map((l) => {
                const signalState = l.signal_state ?? (l.is_green ? "green" : "red");
                const signalColor = SIGNAL_COLORS[signalState] ?? SIGNAL_COLORS.red;
                return (
                  <tr
                    key={l.lane_id}
                    style={{
                      background: signalState === "green" ? "rgba(16,185,129,0.06)" : "transparent",
                      transition: "background 0.3s",
                    }}
                  >
                    <td style={{ ...styles.td, fontWeight: 600 }}>{l.lane_id}</td>
                    <td style={styles.td}>{l.direction}</td>
                    <td style={styles.td}>{l.queue_length.toFixed(1)}</td>
                    <td style={styles.td}>{l.waiting_time.toFixed(1)}</td>
                    <td style={styles.td}>{l.signal_countdown ?? 0}s</td>
                    <td style={styles.td}>{l.vehicle_count}</td>
                    <td style={styles.td}>{l.avg_speed.toFixed(1)}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: signalColor,
                          marginRight: 6,
                          verticalAlign: "middle",
                        }}
                      />
                      <span style={{ fontWeight: 600, color: signalColor }}>
                        {signalState.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */
function Card({ label, value, color, sub }) {
  return (
    <div style={styles.card}>
      <div style={{ ...styles.cardValue, color: color || "#1f2937" }}>{value}</div>
      <div style={styles.cardLabel}>{label}</div>
      {sub && <div style={styles.cardSub}>{sub}</div>}
    </div>
  );
}

function CompareCard({ title, active, stats }) {
  return (
    <div style={{ ...styles.compareCard, ...(active ? styles.compareCardActive : {}) }}>
      <div style={styles.compareTitle}>{title}</div>
      <div style={styles.compareStatus}>{active ? "Running now" : "Stored samples"}</div>
      <div style={styles.compareMetrics}>
        <span>Avg Wait: {stats.samples ? `${stats.avgWait}s` : "N/A"}</span>
        <span>Avg Queue: {stats.samples ? stats.avgQueue : "N/A"}</span>
        <span>Vehicles: {stats.samples ? stats.avgVehicles : "N/A"}</span>
      </div>
      <div style={styles.compareSamples}>{stats.samples} cumulative samples this session</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
const styles = {
  container: {
    width: "100%",
    maxWidth: 1100,
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  error: {
    background: "rgba(239, 68, 68, 0.9)",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: 10,
    fontSize: 14,
    textAlign: "center",
    fontWeight: 500,
  },
  cardsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
  },
  card: {
    background: "rgba(255, 255, 255, 0.75)",
    backdropFilter: "blur(12px)",
    borderRadius: 12,
    padding: "16px 18px",
    border: "1px solid rgba(255, 255, 255, 0.6)",
    boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.04)",
    textAlign: "center",
  },
  cardValue: {
    fontSize: "2rem",
    fontWeight: 800,
    lineHeight: 1.2,
  },
  cardLabel: {
    fontSize: "0.8rem",
    color: "#4b5563",
    fontWeight: 600,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  cardSub: {
    fontSize: "0.75rem",
    color: "#6b7280",
    fontWeight: 500,
    marginTop: 6,
  },
  compareGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
  },
  compareCard: {
    background: "rgba(255, 255, 255, 0.75)",
    borderRadius: 12,
    padding: "14px 16px",
    border: "1px solid rgba(209, 213, 219, 0.8)",
    boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.04)",
  },
  compareCardActive: {
    border: "2px solid #10b981",
  },
  compareTitle: {
    fontSize: "0.95rem",
    fontWeight: 800,
    color: "#1f2937",
  },
  compareStatus: {
    marginTop: 2,
    color: "#6b7280",
    fontSize: "0.75rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  compareMetrics: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
    fontSize: "0.82rem",
    fontWeight: 700,
    color: "#374151",
  },
  compareSamples: {
    marginTop: 8,
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  chartRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 14,
  },
  chartCard: {
    background: "rgba(255, 255, 255, 0.75)",
    backdropFilter: "blur(12px)",
    borderRadius: 12,
    padding: "16px 14px",
    border: "1px solid rgba(255, 255, 255, 0.6)",
    boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.04)",
  },
  chartTitle: {
    margin: "0 0 12px",
    fontSize: "0.95rem",
    fontWeight: 700,
    color: "#1f2937",
    letterSpacing: "0.3px",
  },
  tableCard: {
    background: "rgba(255, 255, 255, 0.75)",
    backdropFilter: "blur(12px)",
    borderRadius: 12,
    padding: "16px 18px",
    border: "1px solid rgba(255, 255, 255, 0.6)",
    boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.04)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
    color: "#374151",
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    borderBottom: "2px solid #e5e7eb",
    color: "#4b5563",
    fontWeight: 600,
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #f3f4f6",
  },
};
