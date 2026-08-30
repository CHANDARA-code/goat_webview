/**
 * @goat/bridge-mock - Camera Barcode/QR Scanner Viewfinder Modal Subsystem
 */

import { isDomAvailable, getOrCreateModalRoot, removeElement } from './dom-utils.js';
import { ScanCodePayload, ScanCodeResult } from '../types.js';
import { mockState } from '../state/store.js';

export class ScannerModalSubsystem {
  private activeModal: HTMLElement | null = null;

  public prompt(payload: ScanCodePayload = {}): Promise<ScanCodeResult> {
    const config = mockState.scanner;
    const defaultScanType = (payload.scanType && payload.scanType[0]) || config.mockScanType || 'QR_CODE';

    if (!isDomAvailable()) {
      return Promise.resolve({
        result: config.mockScanResult,
        scanType: defaultScanType,
        charSet: 'UTF-8',
      });
    }

    return new Promise<ScanCodeResult>((resolve, reject) => {
      this.close();

      const root = getOrCreateModalRoot();
      if (!root) {
        resolve({
          result: config.mockScanResult,
          scanType: defaultScanType,
          charSet: 'UTF-8',
        });
        return;
      }

      const backdrop = document.createElement('div');
      backdrop.className = 'goat-modal-backdrop';
      this.activeModal = backdrop;

      const promptMsg = payload.promptMessage || 'Align QR Code within the frame to scan';

      backdrop.innerHTML = `
        <div class="goat-modal-card" style="max-width: 400px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-weight: 700; font-size: 16px; color: #f8fafc;">Camera Scanner Viewfinder</span>
            <button id="goat-scan-close-x" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">&times;</button>
          </div>

          <!-- Viewfinder Frame -->
          <div style="position: relative; width: 220px; height: 220px; margin: 0 auto 16px; background: #0f172a; border-radius: 16px; border: 2px dashed #22c55e; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; left: 5%; right: 5%; height: 2px; background: #22c55e; box-shadow: 0 0 12px #22c55e; animation: goatScanLaser 2s infinite ease-in-out;"></div>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.5">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01"/>
            </svg>
          </div>

          <p style="margin: 0 0 12px; font-size: 13px; color: #94a3b8;">${promptMsg}</p>

          <!-- Mock Payload Input -->
          <div style="margin-bottom: 14px; text-align: left;">
            <label style="font-size: 12px; color: #cbd5e1; font-weight: 600; display: block; margin-bottom: 4px;">Simulated Code Payload:</label>
            <input id="goat-scan-input" type="text" value="${config.mockScanResult}" style="width: 100%; box-sizing: border-box; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 8px 12px; font-size: 13px; color: #f8fafc; outline: none;" />
          </div>

          <!-- Preset payload tags -->
          <div style="display: flex; gap: 6px; margin-bottom: 16px; justify-content: center; flex-wrap: wrap;">
            <button class="goat-scan-preset" data-val="https://goat.dev/pay?inv=99281" style="background: #334155; color: #94a3b8; border: none; border-radius: 6px; padding: 4px 8px; font-size: 11px; cursor: pointer;">Payment QR</button>
            <button class="goat-scan-preset" data-val="https://example.com/miniapp/order/8129" style="background: #334155; color: #94a3b8; border: none; border-radius: 6px; padding: 4px 8px; font-size: 11px; cursor: pointer;">Deep Link</button>
            <button class="goat-scan-preset" data-val="012345678905" style="background: #334155; color: #94a3b8; border: none; border-radius: 6px; padding: 4px 8px; font-size: 11px; cursor: pointer;">Barcode EAN13</button>
          </div>

          <div style="display: flex; gap: 8px;">
            <button id="goat-scan-cancel-btn" class="goat-modal-btn goat-modal-btn-secondary" style="flex: 1;">Cancel</button>
            <button id="goat-scan-submit-btn" class="goat-modal-btn goat-modal-btn-primary" style="flex: 2; background: #22c55e;">Simulate Scan</button>
          </div>
        </div>
      `;

      root.appendChild(backdrop);

      const input = backdrop.querySelector('#goat-scan-input') as HTMLInputElement;
      const submitBtn = backdrop.querySelector('#goat-scan-submit-btn') as HTMLButtonElement;
      const cancelBtn = backdrop.querySelector('#goat-scan-cancel-btn') as HTMLButtonElement;
      const closeX = backdrop.querySelector('#goat-scan-close-x') as HTMLButtonElement;
      const presets = backdrop.querySelectorAll('.goat-scan-preset');

      presets.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const val = (e.target as HTMLElement).getAttribute('data-val');
          if (val && input) {
            input.value = val;
          }
        });
      });

      const handleScan = () => {
        const resultVal = input ? input.value : config.mockScanResult;
        this.close();
        resolve({
          result: resultVal,
          scanType: defaultScanType,
          charSet: 'UTF-8',
        });
      };

      const handleCancel = () => {
        this.close();
        reject(new Error('User cancelled code scanning'));
      };

      submitBtn?.addEventListener('click', handleScan);
      cancelBtn?.addEventListener('click', handleCancel);
      closeX?.addEventListener('click', handleCancel);
    });
  }

  public close(): void {
    if (this.activeModal) {
      removeElement(this.activeModal);
      this.activeModal = null;
    }
  }
}

export const scannerModal = new ScannerModalSubsystem();
