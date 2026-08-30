/**
 * Embedded HTML/CSS/JS single-page Admin Release Management Dashboard for Goat OTA Server.
 */
export function renderOtaDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Goat OTA Release Management Dashboard</title>
  <style>
    :root {
      --bg-main: #0b0f19;
      --bg-card: #151d2f;
      --bg-card-hover: #1e293b;
      --border: #2e3c54;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg-main);
      color: var(--text);
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .brand svg {
      width: 32px;
      height: 32px;
      fill: var(--accent);
    }
    .brand h1 {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .header-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    select, button, input {
      font-family: inherit;
      font-size: 0.875rem;
      border-radius: 6px;
      border: 1px solid var(--border);
      padding: 0.5rem 0.875rem;
      background: var(--bg-card);
      color: var(--text);
      outline: none;
      transition: all 0.2s;
    }
    select:focus, input:focus {
      border-color: var(--accent);
    }
    button {
      cursor: pointer;
      font-weight: 600;
    }
    .btn-primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .btn-primary:hover {
      background: var(--accent-hover);
    }
    .btn-danger {
      background: var(--danger);
      border-color: var(--danger);
      color: #fff;
    }
    .btn-danger:hover {
      opacity: 0.9;
    }
    .btn-secondary {
      background: var(--bg-card-hover);
      border-color: var(--border);
    }
    main {
      flex: 1;
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
      display: grid;
      grid-gap: 2rem;
    }
    .grid-kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
    }
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.5rem;
    }
    .kpi-title {
      font-size: 0.875rem;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }
    .kpi-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text);
    }
    .kpi-sub {
      font-size: 0.75rem;
      color: var(--success);
      margin-top: 0.25rem;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
    }
    .section-title {
      font-size: 1.125rem;
      font-weight: 600;
    }
    .slider-container {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      margin-top: 1rem;
    }
    .slider-container input[type="range"] {
      flex: 1;
      accent-color: var(--accent);
      cursor: pointer;
    }
    .chips-group {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
      flex-wrap: wrap;
    }
    .chip {
      padding: 0.25rem 0.75rem;
      background: var(--bg-card-hover);
      border: 1px solid var(--border);
      border-radius: 9999px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .chip:hover, .chip.active {
      background: var(--accent);
      border-color: var(--accent);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
    }
    th, td {
      padding: 0.875rem 1rem;
      border-bottom: 1px solid var(--border);
    }
    th {
      color: var(--text-muted);
      font-weight: 600;
      background: rgba(0,0,0,0.1);
    }
    tr:hover td {
      background: var(--bg-card-hover);
    }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-success { background: rgba(16, 185, 129, 0.2); color: var(--success); }
    .badge-warning { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
    .badge-danger { background: rgba(239, 68, 68, 0.2); color: var(--danger); }
    .badge-primary { background: rgba(99, 102, 241, 0.2); color: var(--accent); }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      max-width: 540px;
      width: 90%;
      padding: 2rem;
    }
    .modal-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 1rem;
    }
    .form-group {
      margin-bottom: 1.25rem;
    }
    .form-group label {
      display: block;
      font-size: 0.875rem;
      color: var(--text-muted);
      margin-bottom: 0.375rem;
    }
    .form-group input, .form-group textarea {
      width: 100%;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
      <h1>Goat OTA Enterprise Release Dashboard</h1>
    </div>
    <div class="header-controls">
      <select id="app-select">
        <option value="com.goat.test">com.goat.test</option>
      </select>
      <button class="btn-primary" onclick="openUploadModal()">+ New Release</button>
    </div>
  </header>

  <main>
    <!-- KPIs -->
    <div class="grid-kpis">
      <div class="card">
        <div class="kpi-title">Active Production Version</div>
        <div class="kpi-value" id="kpi-active-version">v1.0.0</div>
        <div class="kpi-sub">Target Release</div>
      </div>
      <div class="card">
        <div class="kpi-title">Canary Allocation</div>
        <div class="kpi-value" id="kpi-canary-pct">100%</div>
        <div class="kpi-sub">Active Traffic</div>
      </div>
      <div class="card">
        <div class="kpi-title">Avg Bandwidth Savings</div>
        <div class="kpi-value" id="kpi-bandwidth-savings">94.2%</div>
        <div class="kpi-sub">Differential Patches</div>
      </div>
      <div class="card">
        <div class="kpi-title">Ed25519 Cryptography</div>
        <div class="kpi-value">Active</div>
        <div class="kpi-sub">RFC 8032 Compliant</div>
      </div>
    </div>

    <!-- Live Canary Governance Slider -->
    <section class="card" id="canary-governance">
      <div class="section-header">
        <h2 class="section-title">Live Canary Rollout Slider</h2>
        <span class="badge badge-primary" id="canary-badge">100% Target Traffic</span>
      </div>
      <p style="font-size: 0.875rem; color: var(--text-muted);">
        Deterministic SHA-256 modulo device partitioning dynamically routes clients between current stable and target versions.
      </p>
      <div class="slider-container">
        <span style="font-size: 0.875rem; font-weight: 600;">0%</span>
        <input type="range" min="0" max="100" value="100" id="canary-slider" oninput="onCanaryChange(this.value)" onchange="saveCanary(this.value)" />
        <span style="font-size: 0.875rem; font-weight: 600;">100%</span>
      </div>
      <div class="chips-group">
        <div class="chip" onclick="setPreset(0)">0% Paused</div>
        <div class="chip" onclick="setPreset(10)">10% Canary</div>
        <div class="chip" onclick="setPreset(25)">25% Beta</div>
        <div class="chip" onclick="setPreset(50)">50% Staged</div>
        <div class="chip active" onclick="setPreset(100)">100% Full</div>
      </div>
    </section>

    <!-- Release History Table -->
    <section class="card" id="releases-table">
      <div class="section-header">
        <h2 class="section-title">Published Releases</h2>
      </div>
      <table>
        <thead>
          <tr>
            <th>Version</th>
            <th>Channel</th>
            <th>Status</th>
            <th>Size</th>
            <th>Patches</th>
            <th>SHA-256</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="releases-tbody">
          <tr>
            <td><span class="badge badge-primary">v1.0.0</span></td>
            <td>production</td>
            <td><span class="badge badge-success">ACTIVE</span></td>
            <td>1.2 MB</td>
            <td>0 patches</td>
            <td><code>e3b0c44298fc...</code></td>
            <td><button class="btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Download</button></td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Bandwidth Savings Metrics -->
    <section class="card" id="delta-savings">
      <div class="section-header">
        <h2 class="section-title">Bandwidth Savings Metrics</h2>
      </div>
      <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1rem;">
        Automated BSDIFF40 delta patches achieve >90% bandwidth reduction compared to full zip downloads.
      </p>
      <table>
        <thead>
          <tr>
            <th>From Version</th>
            <th>To Version</th>
            <th>Patch Size</th>
            <th>Full Target Size</th>
            <th>Savings</th>
            <th>Signature</th>
          </tr>
        </thead>
        <tbody id="patches-tbody">
          <tr>
            <td>v1.0.0</td>
            <td>v1.1.0</td>
            <td>45 KB</td>
            <td>1.2 MB</td>
            <td><span class="badge badge-success">96.2% Saved</span></td>
            <td>Ed25519 Valid</td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>

  <!-- Upload Modal -->
  <div class="modal-backdrop" id="upload-modal">
    <div class="modal">
      <div class="modal-title">Publish New Mini-App Release</div>
      <div class="form-group">
        <label>Version (SemVer)</label>
        <input type="text" id="modal-version" placeholder="e.g. 1.2.0" />
      </div>
      <div class="form-group">
        <label>Channel</label>
        <select id="modal-channel">
          <option value="production">production</option>
          <option value="beta">beta</option>
          <option value="canary">canary</option>
        </select>
      </div>
      <div class="form-group">
        <label>Initial Rollout Percentage (0-100%)</label>
        <input type="number" id="modal-rollout" min="0" max="100" value="100" />
      </div>
      <div class="form-group">
        <label>Release Notes</label>
        <input type="text" id="modal-notes" placeholder="e.g. Bug fixes and performance improvements" />
      </div>
      <div class="form-group">
        <label>Bundle Payload (.zip / base64)</label>
        <input type="file" id="modal-file" />
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeUploadModal()">Cancel</button>
        <button class="btn-primary" onclick="submitRelease()">Sign & Publish</button>
      </div>
    </div>
  </div>

  <script>
    let currentAppId = 'com.goat.test';

    function openUploadModal() {
      document.getElementById('upload-modal').style.display = 'flex';
    }

    function closeUploadModal() {
      document.getElementById('upload-modal').style.display = 'none';
    }

    function onCanaryChange(val) {
      document.getElementById('canary-badge').innerText = val + '% Target Traffic';
      document.getElementById('kpi-canary-pct').innerText = val + '%';
    }

    async function saveCanary(val) {
      try {
        await fetch('/api/v1/ota/apps/' + currentAppId + '/rollout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rolloutPercentage: Number(val) })
        });
      } catch (err) {
        console.error('Failed to update canary', err);
      }
    }

    function setPreset(pct) {
      document.getElementById('canary-slider').value = pct;
      onCanaryChange(pct);
      saveCanary(pct);
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      event.target.classList.add('active');
    }

    async function submitRelease() {
      const version = document.getElementById('modal-version').value;
      const channel = document.getElementById('modal-channel').value;
      const rolloutPercentage = Number(document.getElementById('modal-rollout').value || 100);
      const releaseNotes = document.getElementById('modal-notes').value;
      const fileInput = document.getElementById('modal-file');

      if (!version) return alert('Version required');
      if (!fileInput.files || fileInput.files.length === 0) return alert('File required');

      const file = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = async function() {
        const base64 = reader.result.split(',')[1] || btoa(reader.result);
        const res = await fetch('/api/v1/ota/apps/' + currentAppId + '/releases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version,
            channel,
            rolloutPercentage,
            releaseNotes,
            bundleBase64: base64
          })
        });
        if (res.ok) {
          closeUploadModal();
          location.reload();
        } else {
          const data = await res.json();
          alert('Upload error: ' + (data.error || 'Failed'));
        }
      };
      reader.readAsDataURL(file);
    }
  </script>
</body>
</html>`;
}
