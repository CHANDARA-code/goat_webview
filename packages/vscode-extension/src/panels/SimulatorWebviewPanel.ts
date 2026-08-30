/**
 * SimulatorWebviewPanel — Generates webview HTML for the in-editor mobile simulator.
 */

export interface SimulatorOptions {
  devServerUrl: string;
  device: "iphone-16-pro" | "pixel-9-pro";
  orientation: "portrait" | "landscape";
  theme: "light" | "dark";
}

export class SimulatorWebviewPanel {
  public static generateHtml(opts: SimulatorOptions): string {
    const isIos = opts.device === "iphone-16-pro";
    const isLandscape = opts.orientation === "landscape";

    const width = isLandscape ? (isIos ? 852 : 840) : isIos ? 393 : 412;
    const height = isLandscape ? (isIos ? 393 : 412) : isIos ? 852 : 840;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Goat Phone Simulator</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background-color: ${opts.theme === "dark" ? "#111827" : "#f3f4f6"};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: ${opts.theme === "dark" ? "#f9fafb" : "#111827"};
      min-height: 100vh;
      box-sizing: border-box;
    }
    .toolbar {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      align-items: center;
    }
    .btn {
      padding: 6px 14px;
      background: #4f46e5;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }
    .device-container {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      border-radius: ${isIos ? "50px" : "36px"};
      background: #000000;
      padding: 12px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
      border: 4px solid #374151;
      display: flex;
      flex-direction: column;
    }
    .island-or-punchhole {
      position: absolute;
      top: 18px;
      left: 50%;
      transform: translateX(-50%);
      background: #000;
      z-index: 100;
      ${
        isIos
          ? "width: 120px; height: 35px; border-radius: 20px;"
          : "width: 14px; height: 14px; border-radius: 50%; top: 16px;"
      }
    }
    .screen-iframe {
      width: 100%;
      height: 100%;
      border: none;
      border-radius: ${isIos ? "40px" : "26px"};
      background: white;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span>🐐 <strong>Simulator:</strong> ${opts.device} (${opts.orientation})</span>
    <button class="btn" id="btn-reload" onclick="document.getElementById('simulator-frame').src += ''">Reload</button>
  </div>
  <div class="device-container" data-testid="device-frame">
    <div class="island-or-punchhole"></div>
    <iframe id="simulator-frame" class="screen-iframe" src="${opts.devServerUrl}" title="Goat Mini-App Frame"></iframe>
  </div>
</body>
</html>`;
  }
}
