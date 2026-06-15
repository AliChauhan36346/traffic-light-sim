import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import Dashboard from "./components/Dashboard";
import TrafficScene3D from "./components/TrafficScene3D";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [health, setHealth] = useState(null);
  const [simData, setSimData] = useState(null);
  const [apiError, setApiError] = useState(false);
  const [arrivalRates, setArrivalRates] = useState([0.25, 0.25, 0.25, 0.25]);
  const [controllerMode, setControllerMode] = useState("smart");
  const [configMessage, setConfigMessage] = useState("");

  const fetchSimulation = useCallback(async () => {
    try {
      const [healthRes, simRes] = await Promise.all([
        axios.get(`${API_BASE}/health`),
        axios.get(`${API_BASE}/simulation/current`),
      ]);

      setHealth(healthRes.data);
      setSimData(simRes.data);
      setApiError(false);
    } catch {
      setApiError(true);
    }
  }, []);

  useEffect(() => {
    fetchSimulation();
    const interval = setInterval(fetchSimulation, 2000);
    return () => clearInterval(interval);
  }, [fetchSimulation]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get(`${API_BASE}/simulation/config`);
        setArrivalRates(res.data.arrival_rates ?? [0.25, 0.25, 0.25, 0.25]);
        setControllerMode(res.data.controller_mode ?? "smart");
      } catch {
        setApiError(true);
      }
    };

    fetchConfig();
  }, []);

  const updateArrivalRate = (index, value) => {
    const numericValue = Math.max(0, Number(value) || 0);
    setArrivalRates((prev) => prev.map((rate, i) => (i === index ? numericValue : rate)));
  };

  const applyConfig = async (mode = controllerMode) => {
    try {
      const res = await axios.post(`${API_BASE}/simulation/config`, {
        arrival_rates: arrivalRates,
        controller_mode: mode,
      });
      setControllerMode(res.data.controller_mode ?? mode);
      setArrivalRates(res.data.arrival_rates ?? arrivalRates);
      setConfigMessage("Traffic settings applied");
      setApiError(false);
      fetchSimulation();
    } catch {
      setConfigMessage("Could not apply settings");
      setApiError(true);
    }
  };

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.title}>Traffic Light Simulator</h1>
        <p style={styles.subtitle}>3D Street View | DQN Reinforcement Learning</p>
      </header>
      <TrafficControls
        arrivalRates={arrivalRates}
        controllerMode={controllerMode}
        configMessage={configMessage}
        onRateChange={updateArrivalRate}
        onApply={() => applyConfig()}
        onModeChange={(mode) => applyConfig(mode)}
      />
      <main style={styles.main}>
        <TrafficScene3D simData={simData} error={apiError} />
        <Dashboard apiBase={API_BASE} health={health} sim={simData} error={apiError} />
      </main>
    </div>
  );
}

function TrafficControls({
  arrivalRates,
  controllerMode,
  configMessage,
  onRateChange,
  onApply,
  onModeChange,
}) {
  const roads = ["Road 1 North", "Road 2 South", "Road 3 East", "Road 4 West"];

  return (
    <section style={styles.controls}>
      <div style={styles.controlsHeader}>
        <div>
          <h2 style={styles.controlsTitle}>Traffic Test Controls</h2>
          <p style={styles.controlsHint}>Set incoming traffic in cars per second for each road.</p>
        </div>
        <div style={styles.modeButtons}>
          <button
            type="button"
            style={{
              ...styles.modeButton,
              ...(controllerMode === "smart" ? styles.modeButtonActive : {}),
            }}
            onClick={() => onModeChange("smart")}
          >
            Smart ML-Assisted
          </button>
          <button
            type="button"
            style={{
              ...styles.modeButton,
              ...(controllerMode === "fixed" ? styles.modeButtonActive : {}),
            }}
            onClick={() => onModeChange("fixed")}
          >
            No-ML Fixed Cycle
          </button>
        </div>
      </div>

      <div style={styles.rateGrid}>
        {roads.map((road, index) => (
          <label key={road} style={styles.rateLabel}>
            <span>{road}</span>
            <input
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={arrivalRates[index] ?? 0}
              onChange={(event) => onRateChange(index, event.target.value)}
              style={styles.rateInput}
            />
          </label>
        ))}
      </div>

      <div style={styles.controlsFooter}>
        <button type="button" style={styles.applyButton} onClick={onApply}>
          Apply Traffic
        </button>
        <span style={styles.configMessage}>{configMessage}</span>
      </div>
    </section>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)",
    color: "#1f2937",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  header: {
    textAlign: "center",
    padding: "24px 20px 16px",
    borderBottom: "1px solid rgba(0, 0, 0, 0.05)",
  },
  title: {
    margin: 0,
    fontSize: "2rem",
    fontWeight: 800,
    letterSpacing: "-0.5px",
    background: "linear-gradient(90deg, #e67e22, #f39c12)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: "0.9rem",
    color: "#4b5563",
    fontWeight: 500,
    opacity: 0.8,
  },
  main: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 24,
    padding: "20px",
    maxWidth: 1400,
    margin: "0 auto",
  },
  controls: {
    maxWidth: 1100,
    margin: "18px auto 0",
    padding: "16px 18px",
    borderRadius: 14,
    background: "rgba(255, 255, 255, 0.82)",
    border: "1px solid rgba(255, 255, 255, 0.7)",
    boxShadow: "0 8px 30px rgba(31, 41, 55, 0.06)",
  },
  controlsHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
  },
  controlsTitle: {
    margin: 0,
    fontSize: "1rem",
    color: "#1f2937",
  },
  controlsHint: {
    margin: "3px 0 0",
    fontSize: "0.82rem",
    color: "#6b7280",
  },
  modeButtons: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  modeButton: {
    border: "1px solid #d1d5db",
    borderRadius: 9,
    padding: "9px 12px",
    background: "#ffffff",
    color: "#374151",
    fontWeight: 700,
    cursor: "pointer",
  },
  modeButtonActive: {
    background: "#10b981",
    borderColor: "#10b981",
    color: "#ffffff",
  },
  rateGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginTop: 14,
  },
  rateLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: "0.82rem",
    fontWeight: 700,
    color: "#374151",
  },
  rateInput: {
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "9px 10px",
    fontSize: "0.95rem",
  },
  controlsFooter: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
  },
  applyButton: {
    border: "none",
    borderRadius: 9,
    padding: "10px 16px",
    background: "#f59e0b",
    color: "#111827",
    fontWeight: 800,
    cursor: "pointer",
  },
  configMessage: {
    color: "#4b5563",
    fontSize: "0.82rem",
    fontWeight: 600,
  },
};

