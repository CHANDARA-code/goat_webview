/**
 * @goat/devtools - Biometrics Simulation Modal & Controller
 * Simulated Face ID / Fingerprint prompt with Pass, Fail, Cancel, and Lockout triggers
 * + biometric enrollment status toggle.
 */

import React, { useState } from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import { ScanFace, Fingerprint, CheckCircle, XCircle, AlertTriangle, ShieldCheck, Lock, X } from 'lucide-react';
import type { BiometricType } from '../../types/index.ts';

export interface BiometricsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onAuthenticate?: (result: { success: boolean; error?: string }) => void;
}

export const BiometricsModal: React.FC<BiometricsModalProps> = ({
  isOpen: propIsOpen,
  onClose,
  onAuthenticate,
}) => {
  const {
    biometrics = { type: 'faceId', isEnrolled: true, shouldSucceed: true, isModalOpen: false },
    setBiometrics,
    setBiometricsMode,
  } = useDevToolsStore();

  const [failCount, setFailCount] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);

  const isOpen = propIsOpen !== undefined ? propIsOpen : (biometrics.isModalOpen ?? false);
  const biometricType = biometrics.type || 'faceId';

  const handlePass = () => {
    setFailCount(0);
    setIsLockedOut(false);
    if (typeof setBiometricsMode === 'function') {
      setBiometricsMode('success');
    }
    if (typeof setBiometrics === 'function') {
      setBiometrics({ ...biometrics, isModalOpen: false, shouldSucceed: true });
    }
    if (onAuthenticate) {
      onAuthenticate({ success: true });
    }
    if (onClose) onClose();
  };

  const handleFail = () => {
    const nextCount = failCount + 1;
    setFailCount(nextCount);

    if (nextCount >= 3) {
      setIsLockedOut(true);
      if (typeof setBiometricsMode === 'function') {
        setBiometricsMode('lockout');
      }
      if (typeof setBiometrics === 'function') {
        setBiometrics({ ...biometrics, isModalOpen: false, shouldSucceed: false });
      }
      if (onAuthenticate) {
        onAuthenticate({ success: false, error: 'BIOMETRIC_LOCKOUT: Too many failed attempts' });
      }
    } else {
      if (typeof setBiometricsMode === 'function') {
        setBiometricsMode('fail');
      }
      if (typeof setBiometrics === 'function') {
        setBiometrics({ ...biometrics, shouldSucceed: false });
      }
      if (onAuthenticate) {
        onAuthenticate({ success: false, error: 'BIOMETRIC_AUTH_FAILED: Not recognized' });
      }
    }
  };

  const handleCancel = () => {
    if (typeof setBiometricsMode === 'function') {
      setBiometricsMode('cancel');
    }
    if (typeof setBiometrics === 'function') {
      setBiometrics({ ...biometrics, isModalOpen: false });
    }
    if (onAuthenticate) {
      onAuthenticate({ success: false, error: 'USER_CANCELED' });
    }
    if (onClose) onClose();
  };

  const handleLockoutTrigger = () => {
    setIsLockedOut(true);
    setFailCount(5);
    if (typeof setBiometricsMode === 'function') {
      setBiometricsMode('lockout');
    }
    if (typeof setBiometrics === 'function') {
      setBiometrics({ ...biometrics, shouldSucceed: false });
    }
    if (onAuthenticate) {
      onAuthenticate({ success: false, error: 'BIOMETRIC_LOCKOUT: Device locked' });
    }
  };

  const toggleEnrolled = () => {
    if (typeof setBiometrics === 'function') {
      setBiometrics({ ...biometrics, isEnrolled: !biometrics.isEnrolled });
    }
  };

  const handleTypeChange = (type: BiometricType) => {
    if (typeof setBiometrics === 'function') {
      setBiometrics({ ...biometrics, type });
    }
  };

  const content = (
    <div className="p-4 space-y-4 text-xs select-none" data-testid="biometrics-modal">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-neutral-200 uppercase tracking-wider text-[11px]">
            Biometrics Verification Suite
          </h3>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className={biometrics.isEnrolled ? 'text-emerald-400 font-bold' : 'text-neutral-500'}>
            {biometrics.isEnrolled ? 'Enrolled' : 'Not Enrolled'}
          </span>
          {onClose && (
            <button onClick={onClose} className="text-neutral-400 hover:text-white p-0.5 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Biometric Type Selector */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
          Biometric Hardware Type
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleTypeChange('faceId')}
            className={`p-2.5 rounded-lg border flex items-center gap-2 font-medium transition-colors ${
              biometricType === 'faceId'
                ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <ScanFace className="w-4 h-4 text-blue-400" />
            <span>Face ID (3D Sensor)</span>
          </button>
          <button
            onClick={() => handleTypeChange('fingerprint')}
            className={`p-2.5 rounded-lg border flex items-center gap-2 font-medium transition-colors ${
              biometricType === 'fingerprint' || biometricType === 'touchId'
                ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <Fingerprint className="w-4 h-4 text-purple-400" />
            <span>Fingerprint / Touch ID</span>
          </button>
        </div>
      </div>

      {/* Enrollment Toggle */}
      <div className="p-3 bg-neutral-900/60 rounded-lg border border-neutral-800 flex items-center justify-between">
        <div>
          <div className="font-semibold text-neutral-200">Hardware Enrolled</div>
          <div className="text-[10px] text-neutral-400">
            {biometrics.isEnrolled ? 'Biometrics registered in device enclave' : 'No biometrics registered on device'}
          </div>
        </div>
        <button
          onClick={toggleEnrolled}
          className={`px-3 py-1 rounded text-[10px] font-bold transition-colors ${
            biometrics.isEnrolled ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400'
          }`}
        >
          {biometrics.isEnrolled ? 'Active' : 'Disabled'}
        </button>
      </div>

      {/* Simulation Triggers */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
          Simulate Challenge Outcome
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handlePass}
            className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 shadow transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Pass (Match)</span>
          </button>
          <button
            onClick={handleFail}
            className="py-2.5 px-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 shadow transition-colors"
          >
            <XCircle className="w-4 h-4" />
            <span>Fail (Mismatch)</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleCancel}
            className="py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>User Cancel</span>
          </button>
          <button
            onClick={handleLockoutTrigger}
            className="py-2 px-3 bg-amber-950/80 hover:bg-amber-900 border border-amber-800 text-amber-300 font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Trigger Lockout</span>
          </button>
        </div>
      </div>

      {/* Lockout Warning State */}
      {isLockedOut && (
        <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg flex items-start gap-2 text-rose-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="text-[11px]">
            <span className="font-bold">Biometrics Locked Out: </span>
            Too many failed biometric attempts. Device requires PIN or password to re-enable.
          </div>
        </div>
      )}
    </div>
  );

  return content;
};
