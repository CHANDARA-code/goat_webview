/**
 * @goat/bridge-mock - DOM Utilities & Modal Root Manager
 */

export function isDomAvailable(): boolean {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}

const MODAL_CONTAINER_ID = 'goat-bridge-mock-modal-root';
const STYLES_ID = 'goat-bridge-mock-styles';

export function getOrCreateModalRoot(): HTMLElement | null {
  if (!isDomAvailable()) return null;

  let root = document.getElementById(MODAL_CONTAINER_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = MODAL_CONTAINER_ID;
    root.setAttribute('data-goat-mock-container', 'true');
    Object.assign(root.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '999999',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    });
    document.body.appendChild(root);
  }

  ensureMockStyles();
  return root;
}

export function ensureMockStyles(): void {
  if (!isDomAvailable()) return;
  if (document.getElementById(STYLES_ID)) return;

  const styleEl = document.createElement('style');
  styleEl.id = STYLES_ID;
  styleEl.textContent = `
    .goat-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      animation: goatFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 1000000;
    }
    .goat-modal-card {
      background: #1e293b;
      color: #f8fafc;
      border-radius: 20px;
      padding: 24px;
      width: 90%;
      max-width: 380px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
      text-align: center;
      animation: goatScaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .goat-modal-btn {
      padding: 10px 18px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.15s ease;
    }
    .goat-modal-btn-primary {
      background: #3b82f6;
      color: #ffffff;
    }
    .goat-modal-btn-primary:hover {
      background: #2563eb;
    }
    .goat-modal-btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #94a3b8;
    }
    .goat-modal-btn-secondary:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #f8fafc;
    }
    .goat-modal-btn-danger {
      background: #ef4444;
      color: #ffffff;
    }
    .goat-modal-btn-danger:hover {
      background: #dc2626;
    }
    @keyframes goatFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes goatScaleUp {
      from { transform: scale(0.92); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    @keyframes goatScanLaser {
      0% { top: 10%; opacity: 0.8; }
      50% { top: 85%; opacity: 1; }
      100% { top: 10%; opacity: 0.8; }
    }
  `;
  document.head.appendChild(styleEl);
}

export function removeElement(el: HTMLElement | null): void {
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}
