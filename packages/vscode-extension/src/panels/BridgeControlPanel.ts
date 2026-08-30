/**
 * BridgeControlPanel — Hardware Mock control panel inside VSCode webview.
 */

export interface MockBridgeState {
  biometrics: "success" | "fail" | "locked";
  gps: { lat: number; lng: number };
  battery: number;
  network: "wifi" | "4g" | "3g" | "offline";
  theme: "light" | "dark";
}

export class BridgeControlPanel {
  public static generateHtml(state: MockBridgeState): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Goat Mock Hardware Controls</title>
  <style>
    body { font-family: sans-serif; padding: 16px; font-size: 13px; }
    .control-group { margin-bottom: 16px; }
    label { font-weight: bold; display: block; margin-bottom: 4px; }
    select, input { width: 100%; padding: 6px; box-sizing: border-box; }
  </style>
</head>
<body>
  <h3>🐐 Mock Hardware Controls</h3>
  <div class="control-group">
    <label>Biometrics Auth Simulation</label>
    <select id="sel-biometrics">
      <option value="success" ${state.biometrics === "success" ? "selected" : ""}>Pass (Fingerprint / FaceID)</option>
      <option value="fail" ${state.biometrics === "fail" ? "selected" : ""}>Fail (Unmatched)</option>
      <option value="locked" ${state.biometrics === "locked" ? "selected" : ""}>Lockout (Too Many Attempts)</option>
    </select>
  </div>
  <div class="control-group">
    <label>Network Condition</label>
    <select id="sel-network">
      <option value="wifi" ${state.network === "wifi" ? "selected" : ""}>Wi-Fi</option>
      <option value="4g" ${state.network === "4g" ? "selected" : ""}>4G LTE</option>
      <option value="3g" ${state.network === "3g" ? "selected" : ""}>3G</option>
      <option value="offline" ${state.network === "offline" ? "selected" : ""}>Offline</option>
    </select>
  </div>
  <div class="control-group">
    <label>Battery Level: <span id="val-battery">${state.battery}%</span></label>
    <input type="range" min="0" max="100" value="${state.battery}" id="range-battery" />
  </div>
</body>
</html>`;
  }
}
