/**
 * @goat/bridge-mock - Biometric Prompt DOM Modal Subsystem
 */

import { isDomAvailable, getOrCreateModalRoot, removeElement } from './dom-utils.js';
import { BiometricAuthPayload, BiometricAuthResult } from '../types.js';
import { mockState } from '../state/store.js';

export class BiometricModalSubsystem {
  private activeModal: HTMLElement | null = null;

  public prompt(payload: BiometricAuthPayload = {}): Promise<BiometricAuthResult> {
    const config = mockState.biometrics;

    if (!config.supported) {
      return Promise.resolve({
        authenticated: false,
        error: 'BIOMETRIC_UNAVAILABLE',
        reason: 'Biometric hardware is not supported or enrolled on this device',
      });
    }

    if (config.isLockedOut) {
      return Promise.resolve({
        authenticated: false,
        error: 'BIOMETRIC_LOCKOUT',
        reason: 'Too many failed biometric attempts. Device passcode required.',
      });
    }

    // In non-DOM / headless environment or when autoAuthSuccess is true with no DOM
    if (!isDomAvailable()) {
      if (config.errorOnAuth) {
        return Promise.resolve({
          authenticated: false,
          error: config.errorOnAuth,
          reason: 'Simulated biometric authentication failure',
        });
      }
      return Promise.resolve({
        authenticated: config.autoAuthSuccess,
        token: config.autoAuthSuccess ? 'sim_bio_tok_' + Math.random().toString(36).substring(2, 12) : undefined,
        reason: config.autoAuthSuccess ? 'Authenticated successfully' : 'User cancelled',
      });
    }

    return new Promise<BiometricAuthResult>((resolve) => {
      // Clean up previous modal if open
      this.close();

      const root = getOrCreateModalRoot();
      if (!root) {
        resolve({
          authenticated: config.autoAuthSuccess,
          token: config.autoAuthSuccess ? 'sim_bio_tok_fallback' : undefined,
        });
        return;
      }

      const backdrop = document.createElement('div');
      backdrop.className = 'goat-modal-backdrop';
      this.activeModal = backdrop;

      const title = payload.title || (config.biometryType === 'face' ? 'Face ID' : 'Touch ID');
      const subtitle = payload.subtitle || 'Verify your identity to proceed';
      const negativeText = payload.negativeButtonText || 'Cancel';
      const isFace = config.biometryType === 'face';

      const iconSvg = isFace
        ? `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 12px;"><rect width="18" height="18" x="3" y="3" rx="5"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/><path d="M8 15h8"/><path d="M12 11v2"/></svg>`
        : `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 12px;"><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/></svg>`;

      backdrop.innerHTML = `
        <div class="goat-modal-card" style="max-width: 320px;">
          ${iconSvg}
          <h3 style="margin: 0 0 6px; font-size: 18px; font-weight: 700;">${title}</h3>
          <p style="margin: 0 0 20px; font-size: 13px; color: #94a3b8;">${subtitle}</p>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button id="goat-bio-auth-btn" class="goat-modal-btn goat-modal-btn-primary" style="width: 100%;">
              Authenticate (Match)
            </button>
            <button id="goat-bio-fail-btn" class="goat-modal-btn goat-modal-btn-secondary" style="width: 100%;">
              Fail (Mismatch)
            </button>
            <button id="goat-bio-cancel-btn" class="goat-modal-btn goat-modal-btn-secondary" style="width: 100%; color: #ef4444;">
              ${negativeText}
            </button>
          </div>
        </div>
      `;

      root.appendChild(backdrop);

      const authBtn = backdrop.querySelector('#goat-bio-auth-btn') as HTMLButtonElement;
      const failBtn = backdrop.querySelector('#goat-bio-fail-btn') as HTMLButtonElement;
      const cancelBtn = backdrop.querySelector('#goat-bio-cancel-btn') as HTMLButtonElement;

      authBtn?.addEventListener('click', () => {
        this.close();
        config.failedAttempts = 0;
        resolve({
          authenticated: true,
          token: 'sim_bio_tok_' + Math.random().toString(36).substring(2, 12),
          reason: 'Authenticated successfully',
        });
      });

      failBtn?.addEventListener('click', () => {
        config.failedAttempts++;
        if (config.failedAttempts >= config.maxAttempts) {
          config.isLockedOut = true;
          this.close();
          resolve({
            authenticated: false,
            error: 'BIOMETRIC_LOCKOUT',
            reason: 'Biometric lockout: exceeded maximum failed attempts',
          });
        } else {
          this.close();
          resolve({
            authenticated: false,
            error: 'BIOMETRIC_REJECTED',
            reason: 'Biometric scan did not match',
          });
        }
      });

      cancelBtn?.addEventListener('click', () => {
        this.close();
        resolve({
          authenticated: false,
          reason: 'User cancelled authentication',
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
}

export const biometricModal = new BiometricModalSubsystem();
