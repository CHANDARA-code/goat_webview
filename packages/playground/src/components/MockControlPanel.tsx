import React from "react";
import type { MockState } from "../types.js";

interface MockControlPanelProps {
  mockState: MockState;
  setMockState: React.Dispatch<React.SetStateAction<MockState>>;
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    fontFamily: "system-ui, sans-serif",
    fontSize: "13px",
    overflowY: "auto",
  },
  header: {
    padding: "8px 12px",
    borderBottom: "1px solid #e5e7eb",
    fontWeight: 700,
    fontSize: "13px",
    color: "#374151",
    flexShrink: 0,
  },
  content: {
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontWeight: 600,
    color: "#374151",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  select: {
    padding: "6px 8px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    backgroundColor: "#fff",
    fontSize: "13px",
    color: "#1f2937",
    cursor: "pointer",
    width: "100%",
  },
  input: {
    padding: "6px 8px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    backgroundColor: "#fff",
    fontSize: "13px",
    color: "#1f2937",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  row: {
    display: "flex",
    gap: "8px",
  },
  slider: {
    width: "100%",
    accentColor: "#6366f1",
  },
  toggleGroup: {
    display: "flex",
    gap: "4px",
  },
  toggleBtn: {
    flex: 1,
    padding: "6px 8px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    backgroundColor: "#f9fafb",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
    transition: "all 0.15s",
    color: "#6b7280",
  },
  toggleBtnActive: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
    color: "#fff",
  },
  valueHint: {
    fontSize: "11px",
    color: "#9ca3af",
    textAlign: "right" as const,
  },
};

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div style={styles.section} aria-label={label}>
      <span style={styles.label}>{label}</span>
      <div style={styles.toggleGroup}>
        {options.map((opt) => (
          <button
            key={opt}
            style={
              value === opt
                ? { ...styles.toggleBtn, ...styles.toggleBtnActive }
                : styles.toggleBtn
            }
            onClick={() => onChange(opt)}
            aria-pressed={value === opt}
            data-testid={`toggle-${label.toLowerCase().replace(/\s+/g, "-")}-${opt}`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MockControlPanel({
  mockState,
  setMockState,
}: MockControlPanelProps) {
  function update<K extends keyof MockState>(key: K, value: MockState[K]) {
    setMockState((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div style={styles.panel} data-testid="mock-control-panel">
      <div style={styles.header}>🎛️ Mock Controls</div>
      <div style={styles.content}>
        {/* Platform */}
        <ToggleGroup
          label="Platform"
          options={["ios", "android"] as const}
          value={mockState.platform}
          onChange={(v) => update("platform", v)}
        />

        {/* Theme */}
        <ToggleGroup
          label="Theme"
          options={["light", "dark"] as const}
          value={mockState.theme}
          onChange={(v) => update("theme", v)}
        />

        {/* Biometrics */}
        <ToggleGroup
          label="Biometrics"
          options={["success", "fail", "locked"] as const}
          value={mockState.biometric}
          onChange={(v) => update("biometric", v)}
        />

        {/* Network */}
        <div style={styles.section}>
          <label htmlFor="network-select" style={styles.label}>
            Network
          </label>
          <select
            id="network-select"
            style={styles.select}
            value={mockState.network}
            onChange={(e) =>
              update("network", e.target.value as MockState["network"])
            }
            data-testid="network-select"
          >
            <option value="wifi">📶 WiFi</option>
            <option value="4g">📡 4G</option>
            <option value="3g">📡 3G</option>
            <option value="offline">🚫 Offline</option>
          </select>
        </div>

        {/* Battery */}
        <div style={styles.section}>
          <label htmlFor="battery-slider" style={styles.label}>
            Battery
          </label>
          <input
            id="battery-slider"
            type="range"
            min={0}
            max={100}
            step={1}
            style={styles.slider}
            value={mockState.battery}
            onChange={(e) => update("battery", Number(e.target.value))}
            data-testid="battery-slider"
            aria-label="Battery level"
          />
          <div style={styles.valueHint}>{mockState.battery}%</div>
        </div>

        {/* GPS Spoofer */}
        <div style={styles.section}>
          <span style={styles.label}>GPS Spoofer</span>
          <div style={styles.row}>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="gps-lat"
                style={{ fontSize: "11px", color: "#9ca3af" }}
              >
                Lat
              </label>
              <input
                id="gps-lat"
                type="number"
                step="0.0001"
                style={styles.input}
                value={mockState.gps.lat}
                onChange={(e) =>
                  update("gps", {
                    ...mockState.gps,
                    lat: parseFloat(e.target.value) || 0,
                  })
                }
                data-testid="gps-lat-input"
                aria-label="GPS latitude"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="gps-lng"
                style={{ fontSize: "11px", color: "#9ca3af" }}
              >
                Lng
              </label>
              <input
                id="gps-lng"
                type="number"
                step="0.0001"
                style={styles.input}
                value={mockState.gps.lng}
                onChange={(e) =>
                  update("gps", {
                    ...mockState.gps,
                    lng: parseFloat(e.target.value) || 0,
                  })
                }
                data-testid="gps-lng-input"
                aria-label="GPS longitude"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="gps-accuracy"
              style={{ fontSize: "11px", color: "#9ca3af" }}
            >
              Accuracy (m)
            </label>
            <input
              id="gps-accuracy"
              type="number"
              step="1"
              min="1"
              style={styles.input}
              value={mockState.gps.accuracy}
              onChange={(e) =>
                update("gps", {
                  ...mockState.gps,
                  accuracy: parseInt(e.target.value, 10) || 10,
                })
              }
              data-testid="gps-accuracy-input"
              aria-label="GPS accuracy"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default MockControlPanel;
