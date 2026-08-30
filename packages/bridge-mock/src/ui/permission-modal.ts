/**
 * @goat/bridge-mock - Permission Priming Dialog Modal Subsystem
 */

import { isDomAvailable, getOrCreateModalRoot, removeElement } from './dom-utils.js';
import { PermissionResult } from '../types.js';
import { mockState } from '../state/store.js';

export class PermissionModalSubsystem {
  private activeModal: HTMLElement | null = null;

  public prompt(scope: string, rationale?: string): Promise<PermissionResult> {
    const canonicalScope = scope.toUpperCase();

    if (!isDomAvailable()) {
      const granted = mockState.permissions.has(canonicalScope)
        ? !!mockState.permissions.get(canonicalScope)
        : true;
      return Promise.resolve({
        scope: canonicalScope,
        granted,
        isDeclaredInManifest: true,
      });
    }

    return new Promise<PermissionResult>((resolve) => {
      this.close();

      const root = getOrCreateModalRoot();
      if (!root) {
        resolve({
          scope: canonicalScope,
          granted: true,
          isDeclaredInManifest: true,
        });
        return;
      }

      const backdrop = document.createElement('div');
      backdrop.className = 'goat-modal-backdrop';
      this.activeModal = backdrop;

      const description = rationale || this.getDefaultRationale(canonicalScope);

      backdrop.innerHTML = `
        <div class="goat-modal-card" style="max-width: 340px;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(59, 130, 246, 0.15); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <h3 style="margin: 0 0 8px; font-size: 17px; font-weight: 700;">Allow Permission?</h3>
          <p style="margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #38bdf8;">Scope: ${canonicalScope}</p>
          <p style="margin: 0 0 20px; font-size: 13px; color: #94a3b8; line-height: 1.4;">${description}</p>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button id="goat-perm-allow-always" class="goat-modal-btn goat-modal-btn-primary" style="width: 100%;">
              Allow While Using App
            </button>
            <button id="goat-perm-allow-once" class="goat-modal-btn goat-modal-btn-secondary" style="width: 100%;">
              Allow Once
            </button>
            <button id="goat-perm-deny" class="goat-modal-btn goat-modal-btn-secondary" style="width: 100%; color: #ef4444;">
              Don't Allow
            </button>
          </div>
        </div>
      `;

      root.appendChild(backdrop);

      const allowAlways = backdrop.querySelector('#goat-perm-allow-always') as HTMLButtonElement;
      const allowOnce = backdrop.querySelector('#goat-perm-allow-once') as HTMLButtonElement;
      const deny = backdrop.querySelector('#goat-perm-deny') as HTMLButtonElement;

      allowAlways?.addEventListener('click', () => {
        mockState.permissions.set(canonicalScope, true);
        this.close();
        resolve({
          scope: canonicalScope,
          granted: true,
          isDeclaredInManifest: true,
        });
      });

      allowOnce?.addEventListener('click', () => {
        mockState.permissions.set(canonicalScope, true);
        this.close();
        resolve({
          scope: canonicalScope,
          granted: true,
          isDeclaredInManifest: true,
        });
      });

      deny?.addEventListener('click', () => {
        mockState.permissions.set(canonicalScope, false);
        this.close();
        resolve({
          scope: canonicalScope,
          granted: false,
          isDeclaredInManifest: true,
        });
      });
    });
  }

  private getDefaultRationale(scope: string): string {
    switch (scope) {
      case 'LOCATION':
      case 'SCOPE.USERLOCATION':
        return 'This mini-app requires access to your current GPS location to provide local services and navigation.';
      case 'CAMERA':
      case 'SCOPE.CAMERA':
        return 'This mini-app requires camera access to take photos, record videos, and scan QR codes.';
      case 'BIOMETRIC':
        return 'This mini-app requests biometric verification for secure authentication and transaction signing.';
      case 'CONTACTS':
      case 'SCOPE.ADDRESSBOOK':
        return 'This mini-app requires access to your contacts list to easily select recipients.';
      case 'BLUETOOTH':
      case 'SCOPE.BLUETOOTH':
        return 'This mini-app requires Bluetooth access to scan and communicate with nearby BLE hardware.';
      case 'NOTIFICATION':
      case 'SCOPE.NOTIFICATION':
        return 'This mini-app requests permission to send you local push alerts and updates.';
      default:
        return `This mini-app requests authorization to access protected resource "${scope}".`;
    }
  }

  public close(): void {
    if (this.activeModal) {
      removeElement(this.activeModal);
      this.activeModal = null;
    }
  }
}

export const permissionModal = new PermissionModalSubsystem();
