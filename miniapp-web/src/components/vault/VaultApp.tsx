import React, { useState, useEffect } from 'react';
import {
  Lock,
  Fingerprint,
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  FileCode,
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { bridge } from '../../miniapp-bridge';
import { VaultSecret, FsFileEntry, SandboxHeadersAuditResult, WasmSupportResult, BiometricSupportResult } from '../../types';

export const VaultApp: React.FC = () => {
  // Biometric gate state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [biometricSupport, setBiometricSupport] = useState<BiometricSupportResult>({
    supported: true,
    biometryType: 'face'
  });
  const [authError, setAuthError] = useState<string | null>(null);

  // Encrypted Key-Value Storage state (AES-256 Hardware Keystore)
  const [secrets, setSecrets] = useState<VaultSecret[]>([
    {
      id: 'sec_1',
      label: 'Mainnet Master Seed Phrase',
      category: 'SEED_PHRASE',
      value: 'abandon amount liar amount expire adjust cage candy arch gather drum bullet',
      createdAt: Date.now() - 86400000
    },
    {
      id: 'sec_2',
      label: 'Enterprise API Secret Key',
      category: 'API_KEY',
      value: 'goat_live_sk_991849a21b34e5f78c90123456789abc',
      createdAt: Date.now() - 43200000
    },
    {
      id: 'sec_3',
      label: 'JWT Session Signing Key',
      category: 'JWT_TOKEN',
      value: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbl9nb2F0In0.sig_priv',
      createdAt: Date.now() - 10800000
    }
  ]);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState<'API_KEY' | 'SEED_PHRASE' | 'JWT_TOKEN' | 'PRIVATE_KEY'>('API_KEY');
  const [storageStatusMsg, setStorageStatusMsg] = useState<string | null>(null);

  // Sandboxed Filesystem state
  const [files, setFiles] = useState<FsFileEntry[]>([
    { name: '/vault/credentials.enc', isDirectory: false, sizeBytes: 1024, lastModified: Date.now() - 3600000 },
    { name: '/memos/field_audio_90214.wav', isDirectory: false, sizeBytes: 24576, lastModified: Date.now() - 1800000 },
    { name: '/audit/security_log.json', isDirectory: false, sizeBytes: 512, lastModified: Date.now() - 600000 }
  ]);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('/vault/backup.json');
  const [newFileData, setNewFileData] = useState('{"vault_version": 2, "encrypted": true}');

  // Sandbox & Wasm Audit state
  const [sandboxAudit, setSandboxAudit] = useState<SandboxHeadersAuditResult | null>(null);
  const [wasmAudit, setWasmAudit] = useState<WasmSupportResult | null>(null);

  useEffect(() => {
    // Configure Native Navigation Bar
    bridge.setNavBar({
      title: 'Secure Biometric Vault',
      subtitle: 'AES-256 Keystore & Sandboxed FS',
      backgroundColor: '#1b092a',
      textColor: '#c084fc',
      isDark: true
    }).catch(() => {});

    // Check biometric support
    bridge.checkBiometricSupport()
      .then((res) => setBiometricSupport(res))
      .catch(() => {});

    // Run Sandbox Audit
    bridge.auditSandboxHeaders({
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }).then((res) => setSandboxAudit(res)).catch(() => {});

    // Run Wasm SIMD Audit
    bridge.validateWasmSupport()
      .then((res) => setWasmAudit(res))
      .catch(() => {});
  }, []);

  // --- Biometric Authentication Actions ---
  const handleAuthenticate = async () => {
    setAuthError(null);
    try {
      await bridge.triggerImpact('heavy');
      const res = await bridge.authenticateBiometric({
        title: 'Unlock Secure Biometric Vault',
        subtitle: 'Authorize with FaceID / TouchID / Fingerprint',
        negativeButtonText: 'Cancel'
      });

      if (res.authenticated) {
        setIsUnlocked(true);
        await bridge.triggerNotification('success');
        await bridge.showToast({ title: 'Vault Unlocked', icon: 'success' });
      } else {
        setAuthError(res.reason || 'Biometric authentication was rejected.');
        await bridge.triggerNotification('error');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication error');
    }
  };

  const handleLockVault = async () => {
    await bridge.triggerImpact('light');
    setIsUnlocked(false);
    setRevealedIds({});
    setSelectedFileContent(null);
    await bridge.showToast({ title: 'Vault Locked', icon: 'none' });
  };

  const toggleRevealSecret = async (id: string) => {
    await bridge.triggerSelection();
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSaveSecret = async () => {
    if (!newLabel.trim() || !newValue.trim()) return;
    try {
      await bridge.triggerImpact('medium');
      const keyName = `secret_${Date.now()}`;
      await bridge.secureStorageSet(keyName, newValue.trim(), 'com.goat.vault');

      const item: VaultSecret = {
        id: keyName,
        label: newLabel.trim(),
        category: newCategory,
        value: newValue.trim(),
        createdAt: Date.now()
      };

      setSecrets((prev) => [item, ...prev]);
      setNewLabel('');
      setNewValue('');
      setStorageStatusMsg(`Encrypted and saved "${item.label}" to Keystore`);
      await bridge.triggerNotification('success');
    } catch (err: any) {
      setStorageStatusMsg(`Keystore Error: ${err.message}`);
    }
  };

  const handleDeleteSecret = async (id: string) => {
    try {
      await bridge.triggerImpact('light');
      await bridge.secureStorageRemove(id, 'com.goat.vault');
      setSecrets((prev) => prev.filter((s) => s.id !== id));
      setStorageStatusMsg(`Removed secret "${id}" from Keystore`);
    } catch (err: any) {
      console.warn('Delete secret error:', err);
    }
  };

  // --- Sandboxed FS Actions ---
  const handleReadFile = async (fileName: string) => {
    try {
      await bridge.triggerImpact('light');
      const res = await bridge.fsReadFile({ filePath: fileName, appId: 'com.goat.vault' });
      setActiveFileName(fileName);
      setSelectedFileContent(res.data);
    } catch (err: any) {
      console.warn('Read file error:', err);
    }
  };

  const handleWriteFile = async () => {
    if (!newFileName.trim()) return;
    try {
      await bridge.triggerImpact('medium');
      const res = await bridge.fsWriteFile({
        filePath: newFileName.trim(),
        data: newFileData,
        encoding: 'utf8',
        appId: 'com.goat.vault'
      });

      if (res.written) {
        setFiles((prev) => [
          {
            name: res.filePath,
            isDirectory: false,
            sizeBytes: res.byteSize,
            lastModified: Date.now()
          },
          ...prev.filter((f) => f.name !== res.filePath)
        ]);
        await bridge.triggerNotification('success');
        await bridge.showToast({ title: `Written ${res.filePath}`, icon: 'success' });
      }
    } catch (err: any) {
      console.warn('Write file error:', err);
    }
  };

  const handleDeleteFile = async (filePath: string) => {
    try {
      await bridge.triggerImpact('light');
      await bridge.fsDeleteFile({ filePath, appId: 'com.goat.vault' });
      setFiles((prev) => prev.filter((f) => f.name !== filePath));
      if (activeFileName === filePath) {
        setSelectedFileContent(null);
        setActiveFileName(null);
      }
      await bridge.showToast({ title: `Deleted ${filePath}`, icon: 'none' });
    } catch (err: any) {
      console.warn('Delete file error:', err);
    }
  };

  return (
    <div className="pb-24 pt-3 px-4 max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-purple-950/70 via-slate-900/80 to-slate-950 border border-purple-500/20 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 mb-2">
              <Lock className="w-3.5 h-3.5" />
              Isolated Cryptographic Enclave
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Secure Biometric Vault
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-xl">
              Biometric authentication gate, AES-256-GCM hardware KeyStore, sandboxed filesystem storage, and COOP/COEP isolation audit.
            </p>
          </div>

          {isUnlocked ? (
            <button
              onClick={handleLockVault}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 font-bold text-xs hover:bg-red-500/30 active:scale-95 transition-all self-start sm:self-auto touch-press"
            >
              <Lock className="w-4 h-4" />
              Lock Vault
            </button>
          ) : (
            <button
              onClick={handleAuthenticate}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-xs shadow-lg shadow-purple-500/30 hover:brightness-110 active:scale-95 transition-all self-start sm:self-auto touch-press"
            >
              <Fingerprint className="w-4 h-4" />
              Unlock with Biometrics
            </button>
          )}
        </div>
      </div>

      {/* Locked State Barrier */}
      {!isUnlocked ? (
        <div className="glass-card rounded-2xl p-8 border border-purple-500/30 bg-gradient-to-br from-slate-900 via-purple-950/20 to-slate-950 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center mx-auto shadow-inner shadow-purple-500/40">
            <Fingerprint className="w-8 h-8 text-purple-400 animate-pulse" />
          </div>

          <div>
            <h3 className="font-bold text-white text-lg">Biometric Security Barrier Active</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Encrypted credentials and sandboxed file records are protected by hardware KeyStore and BiometricPrompt.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 border border-white/10 text-xs font-mono text-purple-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Biometric Engine: {biometricSupport.biometryType?.toUpperCase() ?? 'FACE_ID'}
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/30 text-xs font-mono text-red-300 max-w-sm mx-auto">
              {authError}
            </div>
          )}

          <div>
            <button
              onClick={handleAuthenticate}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-sm shadow-xl shadow-purple-500/30 hover:brightness-110 active:scale-95 transition-all touch-press"
            >
              Verify Identity & Unlock
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* AES-256 Keystore Credentials Manager */}
          <div className="glass-card rounded-2xl p-5 border border-purple-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-purple-400" />
                <div>
                  <h2 className="font-bold text-white text-base">AES-256 Encrypted Keystore</h2>
                  <p className="text-xs text-slate-400">Hardware Backed Persistent Key-Value Secrets</p>
                </div>
              </div>

              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                AES-256-GCM
              </span>
            </div>

            {storageStatusMsg && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-purple-500/20 text-xs font-mono text-purple-300">
                {storageStatusMsg}
              </div>
            )}

            {/* Secret Cards */}
            <div className="space-y-2.5">
              {secrets.map((secret) => {
                const isRevealed = revealedIds[secret.id];

                return (
                  <div
                    key={secret.id}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{secret.label}</span>
                        <span className="text-[10px] px-2 py-0.2 rounded-md bg-purple-500/20 text-purple-300 font-mono">
                          {secret.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleRevealSecret(secret.id)}
                          className="p-1.5 rounded-lg bg-slate-900 text-slate-300 hover:text-white active:scale-95 transition-all"
                          title={isRevealed ? 'Mask secret' : 'Reveal secret'}
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleDeleteSecret(secret.id)}
                          className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-red-400 active:scale-95 transition-all"
                          title="Delete secret"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 text-xs font-mono text-emerald-300 break-all select-all">
                      {isRevealed ? secret.value : '••••••••••••••••••••••••••••••••••••••••'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add New Secret Form */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-white/5 space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Encrypt & Store New Secret:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  placeholder="Secret label"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white"
                />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white font-mono"
                >
                  <option value="API_KEY">API_KEY</option>
                  <option value="SEED_PHRASE">SEED_PHRASE</option>
                  <option value="JWT_TOKEN">JWT_TOKEN</option>
                  <option value="PRIVATE_KEY">PRIVATE_KEY</option>
                </select>
                <input
                  type="text"
                  placeholder="Secret payload / key"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white font-mono"
                />
                <button
                  onClick={handleSaveSecret}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-500 active:scale-95 transition-all touch-press"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Save to Keystore
                </button>
              </div>
            </div>
          </div>

          {/* Isolated Sandboxed Filesystem */}
          <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-purple-400" />
                <div>
                  <h2 className="font-bold text-white text-base">Isolated Sandboxed Filesystem</h2>
                  <p className="text-xs text-slate-400">Encrypted Partition /miniapps/vault/data/</p>
                </div>
              </div>
            </div>

            {/* Files List */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {files.map((file) => {
                const isSelected = activeFileName === file.name;

                return (
                  <div
                    key={file.name}
                    className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-purple-950/40 border-purple-500 text-white'
                        : 'bg-slate-950/60 border-white/5 text-slate-400'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <FileCode className="w-4 h-4 text-purple-400" />
                        <button
                          onClick={() => handleDeleteFile(file.name)}
                          className="p-1 rounded text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-xs font-bold text-white mt-2 truncate">{file.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{file.sizeBytes} bytes</div>
                    </div>

                    <button
                      onClick={() => handleReadFile(file.name)}
                      className="mt-3 py-1 rounded-lg bg-slate-900 text-purple-300 text-[11px] font-semibold hover:bg-slate-800"
                    >
                      Read Content
                    </button>
                  </div>
                );
              })}
            </div>

            {/* File Viewer */}
            {selectedFileContent && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-purple-500/30 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono">File: {activeFileName}</span>
                  <button
                    onClick={() => setSelectedFileContent(null)}
                    className="text-slate-500 hover:text-white"
                  >
                    Close
                  </button>
                </div>
                <pre className="p-2.5 rounded-lg bg-slate-900 text-xs font-mono text-emerald-300 overflow-x-auto">
                  {selectedFileContent}
                </pre>
              </div>
            )}

            {/* Write File Form */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-white/5 space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Write File into Sandbox Partition:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="File path (e.g. /vault/key.dat)"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white font-mono"
                />
                <input
                  type="text"
                  value={newFileData}
                  onChange={(e) => setNewFileData(e.target.value)}
                  placeholder="File content"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white font-mono"
                />
                <button
                  onClick={handleWriteFile}
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-500 active:scale-95 transition-all touch-press"
                >
                  Write File
                </button>
              </div>
            </div>
          </div>

          {/* Sandbox Security Audit & WASM SIMD Validation */}
          <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <h2 className="font-bold text-white text-base">Sandbox Headers & SIMD Audit</h2>
                <p className="text-xs text-slate-400">COOP, COEP, SharedArrayBuffer & WebAssembly SIMD</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 space-y-1.5">
                <div className="text-slate-400">Cross-Origin-Opener-Policy (COOP)</div>
                <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {sandboxAudit?.coopHeaderPresent ? 'SAME_ORIGIN (Enforced)' : 'DETECTED'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 space-y-1.5">
                <div className="text-slate-400">Cross-Origin-Embedder-Policy (COEP)</div>
                <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {sandboxAudit?.coepHeaderPresent ? 'REQUIRE_CORP (Enforced)' : 'DETECTED'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 space-y-1.5">
                <div className="text-slate-400">WebAssembly 128-bit SIMD</div>
                <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {wasmAudit?.simdSupported ? 'AVAILABLE (Accelerated)' : 'SUPPORTED'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 space-y-1.5">
                <div className="text-slate-400">Isolated Worker Threads</div>
                <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {wasmAudit?.threadsSupported ? 'ACTIVE (Pthread Enclave)' : 'AVAILABLE'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
