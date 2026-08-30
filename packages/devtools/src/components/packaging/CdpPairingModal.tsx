/**
 * @goat/devtools - Chrome DevTools Protocol (CDP) Device Pairing Modal
 * QR Code pairing generator connected to @goat/server for physical device live debugging.
 */

import React, { useState } from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import { QrCode, Smartphone, Wifi, RefreshCw, CheckCircle2, Copy, Check, X } from 'lucide-react';
import type { QrPairingState } from '../../types/packaging.ts';

export interface CdpPairingModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const CdpPairingModal: React.FC<CdpPairingModalProps> = ({
  isOpen = true,
  onClose,
}) => {
  const {
    qrPairing = {
      pairingCode: 'GOAT-9842',
      token: 'cdp_token_xyz981',
      wsUrl: 'ws://localhost:8080/devtools/page/goat-miniapp-live',
      isConnected: false,
      status: 'pending',
      clientDevice: {
        name: 'iPhone 16 Pro',
        platform: 'iOS 18.2',
        model: 'A3293',
        ipAddress: '192.168.1.142',
      },
    },
    setQrPairing,
  } = useDevToolsStore();

  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleRegenerate = () => {
    const randomCode = `GOAT-${Math.floor(1000 + Math.random() * 9000)}`;
    const randomToken = `cdp_token_${Math.random().toString(36).slice(2, 8)}`;
    const newPairing: Partial<QrPairingState> = {
      pairingCode: randomCode,
      token: randomToken,
      wsUrl: `ws://localhost:8080/devtools/page/goat-${randomCode.toLowerCase()}`,
      status: 'pending',
      isConnected: false,
    };
    if (typeof setQrPairing === 'function') {
      setQrPairing(newPairing);
    }
  };

  const handleCopyUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(qrPairing.wsUrl || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm select-none p-4" data-testid="cdp-pairing-modal">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Physical Device Live Relay</h3>
              <p className="text-[11px] text-neutral-400">
                Scan QR code from Goat Mini-App Client to debug on real hardware
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col items-center space-y-4 text-xs">
          {/* QR Code Container */}
          <div className="p-4 bg-white rounded-2xl shadow-xl flex flex-col items-center justify-center">
            {/* SVG QR Code Simulation */}
            <svg
              width="180"
              height="180"
              viewBox="0 0 180 180"
              className="w-44 h-44"
              data-testid="cdp-qr-svg"
            >
              {/* Corner markers */}
              <rect x="10" y="10" width="45" height="45" fill="black" rx="6" />
              <rect x="18" y="18" width="29" height="29" fill="white" rx="3" />
              <rect x="25" y="25" width="15" height="15" fill="black" rx="2" />

              <rect x="125" y="10" width="45" height="45" fill="black" rx="6" />
              <rect x="133" y="18" width="29" height="29" fill="white" rx="3" />
              <rect x="140" y="25" width="15" height="15" fill="black" rx="2" />

              <rect x="10" y="125" width="45" height="45" fill="black" rx="6" />
              <rect x="18" y="133" width="29" height="29" fill="white" rx="3" />
              <rect x="25" y="140" width="15" height="15" fill="black" rx="2" />

              {/* Data matrix pattern */}
              <rect x="65" y="15" width="10" height="10" fill="black" />
              <rect x="85" y="15" width="10" height="10" fill="black" />
              <rect x="105" y="25" width="10" height="10" fill="black" />

              <rect x="20" y="65" width="10" height="10" fill="black" />
              <rect x="40" y="85" width="10" height="10" fill="black" />
              <rect x="65" y="65" width="50" height="50" fill="#2563eb" rx="8" />

              {/* Center Goat Logo Dot */}
              <circle cx="90" cy="90" r="14" fill="white" />
              <circle cx="90" cy="90" r="8" fill="#2563eb" />

              <rect x="125" y="65" width="10" height="10" fill="black" />
              <rect x="145" y="85" width="10" height="10" fill="black" />
              <rect x="65" y="125" width="10" height="10" fill="black" />
              <rect x="85" y="145" width="10" height="10" fill="black" />
              <rect x="105" y="135" width="10" height="10" fill="black" />
              <rect x="125" y="125" width="10" height="10" fill="black" />
              <rect x="145" y="145" width="10" height="10" fill="black" />
            </svg>
            <div className="mt-2 text-neutral-800 font-mono text-[11px] font-bold">
              Pairing Code: <span className="text-blue-600">{qrPairing.pairingCode || 'GOAT-9842'}</span>
            </div>
          </div>

          {/* Connection Status */}
          <div className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  qrPairing.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="font-semibold text-neutral-200">
                {qrPairing.isConnected ? 'Connected to Device' : 'Waiting for Device Pairing...'}
              </span>
            </div>
            <button
              onClick={handleRegenerate}
              className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white transition-colors"
              title="Regenerate QR code"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Regenerate</span>
            </button>
          </div>

          {/* WebSocket Relay URL */}
          <div className="w-full space-y-1">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              CDP Relay Endpoint
            </div>
            <div className="flex items-center gap-1 bg-neutral-950 p-2 rounded-lg border border-neutral-800 font-mono text-[10px] text-neutral-300">
              <span className="truncate flex-1 text-blue-400">{qrPairing.wsUrl}</span>
              <button
                onClick={handleCopyUrl}
                className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
                title="Copy WS URL"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 flex justify-end gap-2 bg-neutral-900/50">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium rounded-lg text-xs transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
