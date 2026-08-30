/**
 * @goat/bridge-mock - External Link Warning Interstitial Modal Subsystem
 */

import { isDomAvailable, getOrCreateModalRoot, removeElement } from './dom-utils.js';
import { OpenExternalLinkPayload, OpenExternalLinkResult } from '../types.js';

export class ExternalLinkModalSubsystem {
  private activeModal: HTMLElement | null = null;
  private optedOutHosts: Set<string> = new Set();

  public prompt(payload: OpenExternalLinkPayload): Promise<OpenExternalLinkResult> {
    const rawUrl = payload.url || '';
    let host = 'external-domain.com';
    try {
      const parsed = new URL(rawUrl);
      host = parsed.hostname;
    } catch {
      host = rawUrl;
    }

    if (payload.skipWarningIfOptedOut && this.optedOutHosts.has(host)) {
      return Promise.resolve({
        opened: true,
        destinationHost: host,
      });
    }

    if (!isDomAvailable()) {
      return Promise.resolve({
        opened: true,
        destinationHost: host,
      });
    }

    return new Promise<OpenExternalLinkResult>((resolve) => {
      this.close();

      const root = getOrCreateModalRoot();
      if (!root) {
        resolve({
          opened: true,
          destinationHost: host,
        });
        return;
      }

      const backdrop = document.createElement('div');
      backdrop.className = 'goat-modal-backdrop';
      this.activeModal = backdrop;

      backdrop.innerHTML = `
        <div class="goat-modal-card" style="max-width: 360px;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(234, 179, 8, 0.15); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h3 style="margin: 0 0 8px; font-size: 17px; font-weight: 700;">Leaving Mini-App</h3>
          <p style="margin: 0 0 10px; font-size: 13px; color: #94a3b8; line-height: 1.4;">
            You are about to navigate to an external website:
          </p>
          <div style="background: #0f172a; padding: 10px; border-radius: 8px; font-size: 12px; font-family: monospace; color: #38bdf8; word-break: break-all; margin-bottom: 16px; border: 1px solid #334155;">
            ${rawUrl}
          </div>
          <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 18px;">
            <input type="checkbox" id="goat-link-optout" style="cursor: pointer;" />
            <label for="goat-link-optout" style="font-size: 12px; color: #cbd5e1; cursor: pointer;">Don't ask again for this site</label>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="goat-link-cancel-btn" class="goat-modal-btn goat-modal-btn-secondary" style="flex: 1;">Cancel</button>
            <button id="goat-link-continue-btn" class="goat-modal-btn goat-modal-btn-primary" style="flex: 1.5; background: #eab308; color: #0f172a;">Continue</button>
          </div>
        </div>
      `;

      root.appendChild(backdrop);

      const continueBtn = backdrop.querySelector('#goat-link-continue-btn') as HTMLButtonElement;
      const cancelBtn = backdrop.querySelector('#goat-link-cancel-btn') as HTMLButtonElement;
      const optoutCheck = backdrop.querySelector('#goat-link-optout') as HTMLInputElement;

      continueBtn?.addEventListener('click', () => {
        if (optoutCheck?.checked) {
          this.optedOutHosts.add(host);
        }
        this.close();
        resolve({
          opened: true,
          destinationHost: host,
        });
      });

      cancelBtn?.addEventListener('click', () => {
        this.close();
        resolve({
          opened: false,
          destinationHost: host,
        });
      });
    });
  }

  public close(): void {
    if (this.activeModal) {
      removeElement(this.activeModal);
      this.activeModal = null;
    }
  }

  public clearOptOuts(): void {
    this.optedOutHosts.clear();
  }
}

export const externalLinkModal = new ExternalLinkModalSubsystem();
