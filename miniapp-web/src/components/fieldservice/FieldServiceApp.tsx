import React, { useState, useEffect } from 'react';
import {
  Navigation2,
  MapPin,
  Compass,
  QrCode,
  Mic,
  Play,
  Square,
  Radio,
  Plus,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { bridge } from '../../miniapp-bridge';
import { LocationData, GeofenceRegionResult, ChooseLocationResult } from '../../types';

export const FieldServiceApp: React.FC = () => {
  // Real-time GPS state
  const [isLocating, setIsLocating] = useState(false);
  const [location, setLocation] = useState<LocationData>({
    latitude: 37.774929,
    longitude: -122.419416,
    speed: 0.0,
    accuracy: 3.5,
    altitude: 16.4,
    heading: 90
  });
  const [chosenPlace, setChosenPlace] = useState<ChooseLocationResult | null>(null);

  // Geofence state
  const [geofences, setGeofences] = useState<GeofenceRegionResult[]>([
    { geofenceId: 'geo_solar_array_a', latitude: 37.7750, longitude: -122.4195, radiusMeters: 150, transitionType: 'BOTH' },
    { geofenceId: 'geo_substation_b', latitude: 37.7710, longitude: -122.4150, radiusMeters: 250, transitionType: 'BOTH' }
  ]);
  const [newFenceId, setNewFenceId] = useState('geo_depot_c');
  const [newFenceRadius, setNewFenceRadius] = useState<number>(200);
  const [geofenceStatusMsg, setGeofenceStatusMsg] = useState<string | null>(null);
  const [activeInsideFences, setActiveInsideFences] = useState<string[]>(['geo_solar_array_a']);

  // Barcode / QR Code scanner state
  const [scannedAssetCode, setScannedAssetCode] = useState<string | null>('GOAT-SOLAR-INVERTER-9941');
  const [scanType, setScanType] = useState<string>('QR_CODE');

  // Audio Voice Memo state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioState, setAudioState] = useState<'playing' | 'paused' | 'stopped'>('stopped');
  const [savedMemos, setSavedMemos] = useState<Array<{ id: string; title: string; duration: string; timestamp: string; size: string }>>([
    { id: 'memo_1', title: 'Solar Array Inverter Voltage Log', duration: '0:42', timestamp: '10:14 AM', size: '24 KB' },
    { id: 'memo_2', title: 'Substation B Relay Inspection Report', duration: '1:15', timestamp: '11:30 AM', size: '48 KB' }
  ]);
  const [memoNote, setMemoNote] = useState('');

  useEffect(() => {
    // Configure Native Navigation Bar
    bridge.setNavBar({
      title: 'Field Service Dispatch',
      subtitle: 'Real-Time RTK GPS & Geofences',
      backgroundColor: '#1c1305',
      textColor: '#fbbf24',
      isDark: true
    }).catch(() => {});

    // Initial GPS fetch
    refreshGps();
  }, []);

  // Timer effect for voice memo recording
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // --- Location Actions ---
  const refreshGps = async () => {
    setIsLocating(true);
    try {
      await bridge.triggerImpact('light');
      const loc = await bridge.getLocation({ type: 'wgs84', highAccuracy: true });
      if (loc) {
        setLocation(loc);
      }
    } catch (err: any) {
      console.warn('GPS fetch fallback:', err);
    } finally {
      setIsLocating(false);
    }
  };

  const handleChooseLocation = async () => {
    try {
      await bridge.triggerImpact('medium');
      const res = await bridge.chooseLocation();
      setChosenPlace(res);
      await bridge.triggerNotification('success');
    } catch (err: any) {
      console.warn('Choose location fallback:', err);
    }
  };

  const handleOpenNativeMap = async () => {
    try {
      await bridge.triggerImpact('medium');
      await bridge.openLocation({
        latitude: location.latitude,
        longitude: location.longitude,
        name: 'Worksite Alpha: Solar Array A',
        address: '100 Enterprise Way, San Francisco, CA'
      });
    } catch (err: any) {
      console.warn('Open map error:', err);
    }
  };

  // --- Geofence Actions ---
  const handleAddGeofence = async () => {
    if (!newFenceId.trim()) return;
    try {
      await bridge.triggerImpact('heavy');
      const ok = await bridge.startGeofence({
        geofenceId: newFenceId.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
        radiusMeters: newFenceRadius,
        transitionType: 'BOTH'
      });

      if (ok) {
        const newFence: GeofenceRegionResult = {
          geofenceId: newFenceId.trim(),
          latitude: location.latitude,
          longitude: location.longitude,
          radiusMeters: newFenceRadius,
          transitionType: 'BOTH'
        };
        setGeofences((prev) => [...prev, newFence]);
        setGeofenceStatusMsg(`Registered Geofence "${newFence.geofenceId}" (Radius: ${newFence.radiusMeters}m)`);
        setNewFenceId(`geo_region_${Date.now().toString().slice(-4)}`);
        await bridge.triggerNotification('success');
      }
    } catch (err: any) {
      setGeofenceStatusMsg(`Geofence Error: ${err.message}`);
    }
  };

  const handleRemoveGeofence = async (fenceId: string) => {
    try {
      await bridge.triggerImpact('light');
      await bridge.stopGeofence(fenceId);
      setGeofences((prev) => prev.filter((f) => f.geofenceId !== fenceId));
      setActiveInsideFences((prev) => prev.filter((id) => id !== fenceId));
      setGeofenceStatusMsg(`Decommissioned Geofence "${fenceId}"`);
    } catch (err: any) {
      console.warn('Stop geofence error:', err);
    }
  };

  const handleEvaluateGeofence = async () => {
    try {
      await bridge.triggerImpact('medium');
      const res = await bridge.evaluateGeofence(location.latitude, location.longitude);
      if (res?.events && res.events.length > 0) {
        const insideIds = res.events
          .filter((e) => e.transition === 'ENTER')
          .map((e) => e.geofenceId);
        setActiveInsideFences(insideIds);
        setGeofenceStatusMsg(`Evaluated: Inside ${insideIds.length} boundary zones.`);
        await bridge.triggerNotification('success');
      }
    } catch (err: any) {
      console.warn('Evaluate geofence error:', err);
    }
  };

  // --- Barcode / QR Scanner Actions ---
  const handleScanAssetTag = async () => {
    try {
      await bridge.triggerImpact('heavy');
      const res = await bridge.scanCode({
        scanType: ['QR_CODE', 'BARCODE', 'DATA_MATRIX']
      });
      if (res) {
        setScannedAssetCode(res.result);
        setScanType(res.scanType);
        await bridge.triggerNotification('success');
        await bridge.showToast({ title: `Scanned: ${res.result}`, icon: 'success' });
      }
    } catch (err: any) {
      await bridge.showToast({ title: err.message || 'Scan error', icon: 'error' });
    }
  };

  // --- Voice Memo Actions & Sandboxed FS ---
  const handleToggleRecord = async () => {
    if (isRecording) {
      setIsRecording(false);
      await bridge.triggerNotification('success');

      // Save memo to sandboxed filesystem
      const memoId = `memo_${Date.now()}`;
      const fileName = `/memos/${memoId}.wav`;
      const memoTitle = memoNote.trim() || `Field Audio Note #${savedMemos.length + 1}`;

      try {
        await bridge.fsWriteFile({
          filePath: fileName,
          data: `RIFF_AUDIO_LOG_${memoTitle}_DATA_BYTES`,
          encoding: 'utf8'
        });

        setSavedMemos((prev) => [
          {
            id: memoId,
            title: memoTitle,
            duration: `0:${recordSeconds < 10 ? '0' : ''}${recordSeconds}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            size: `${(recordSeconds * 8 + 12)} KB`
          },
          ...prev
        ]);
        setMemoNote('');
        await bridge.showToast({ title: `Persisted ${fileName} to Sandbox FS`, icon: 'success' });
      } catch (e: any) {
        console.warn('FS write error:', e);
      }
    } else {
      await bridge.triggerImpact('heavy');
      setIsRecording(true);
    }
  };

  const handlePlayAudio = async (src: string) => {
    try {
      if (audioState === 'playing') {
        await bridge.pauseAudio();
        setAudioState('paused');
      } else {
        await bridge.triggerImpact('light');
        await bridge.playAudio({ src, title: 'Field Audio Memo' });
        setAudioState('playing');
      }
    } catch (err) {
      console.warn('Audio player error:', err);
    }
  };

  return (
    <div className="pb-24 pt-3 px-4 max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-amber-950/70 via-slate-900/80 to-slate-950 border border-amber-500/20 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
            <Navigation2 className="w-3.5 h-3.5" />
            Field Operations & RTK Telemetry
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Field Service & Geofence Dispatch
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            Sub-meter GPS telemetry, circular geofence boundary monitoring, camera asset tag QR scanning, and sandboxed audio voice memos.
          </p>
        </div>
      </div>

      {/* Real-Time GPS Location Section */}
      <div className="glass-card rounded-2xl p-5 border border-amber-500/30 bg-gradient-to-br from-slate-900/90 to-amber-950/40 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-bold text-white text-base">Real-Time GPS Location</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  RTK High Accuracy (±{location.accuracy.toFixed(1)}m)
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={refreshGps}
            disabled={isLocating}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs shadow-md shadow-amber-500/30 hover:brightness-110 active:scale-95 transition-all touch-press disabled:opacity-50"
          >
            <Compass className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            {isLocating ? 'Locating...' : 'Refresh GPS'}
          </button>
        </div>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div className="p-3 rounded-xl bg-slate-950 border border-white/5">
            <div className="text-[10px] text-slate-400">Latitude</div>
            <div className="text-sm font-bold text-amber-300">{location.latitude.toFixed(6)}°</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-white/5">
            <div className="text-[10px] text-slate-400">Longitude</div>
            <div className="text-sm font-bold text-amber-300">{location.longitude.toFixed(6)}°</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-white/5">
            <div className="text-[10px] text-slate-400">Altitude</div>
            <div className="text-sm font-bold text-white">{location.altitude.toFixed(1)} m</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-white/5">
            <div className="text-[10px] text-slate-400">Speed / Heading</div>
            <div className="text-sm font-bold text-white">
              {location.speed.toFixed(1)} m/s • {Math.round(location.heading || 0)}°
            </div>
          </div>
        </div>

        {/* Map Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={handleOpenNativeMap}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-slate-200 text-xs font-semibold hover:bg-slate-700 active:scale-95 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Native Maps
          </button>

          <button
            onClick={handleChooseLocation}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-slate-200 text-xs font-semibold hover:bg-slate-700 active:scale-95 transition-all"
          >
            <MapPin className="w-3.5 h-3.5" />
            Pick Map Coordinate
          </button>
        </div>

        {chosenPlace && (
          <div className="p-3 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono">
            <div className="text-slate-400">Picked Location:</div>
            <div className="text-white font-bold">{chosenPlace.name} ({chosenPlace.address})</div>
            <div className="text-amber-400 text-[11px]">{chosenPlace.latitude}, {chosenPlace.longitude}</div>
          </div>
        )}
      </div>

      {/* Circular Geofence Boundary Monitoring */}
      <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-bold text-white text-base">Circular Geofence Monitoring</h2>
              <p className="text-xs text-slate-400">Autonomous Boundary Trigger & Region Polling</p>
            </div>
          </div>

          <button
            onClick={handleEvaluateGeofence}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-white/10 text-slate-200 font-bold text-xs hover:bg-slate-700 active:scale-95 transition-all"
          >
            Evaluate Boundary
          </button>
        </div>

        {/* Status notice */}
        {geofenceStatusMsg && (
          <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/20 text-xs font-mono text-amber-300">
            {geofenceStatusMsg}
          </div>
        )}

        {/* Active Geofences List */}
        <div className="space-y-2.5">
          {geofences.map((fence) => {
            const isInside = activeInsideFences.includes(fence.geofenceId);

            return (
              <div
                key={fence.geofenceId}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                  isInside
                    ? 'bg-amber-500/10 border-amber-500/40 text-white'
                    : 'bg-slate-950/60 border-white/5 text-slate-400'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span>{fence.geofenceId}</span>
                    {isInside && (
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        INSIDE BOUNDARY
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    Radius: {fence.radiusMeters}m • Center: {fence.latitude.toFixed(4)}, {fence.longitude.toFixed(4)}
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveGeofence(fence.geofenceId)}
                  className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-red-400 active:scale-95 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Add Geofence Form */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-white/5 space-y-2">
          <label className="text-xs font-semibold text-slate-300">
            Create New Geofence Region at Current GPS:
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newFenceId}
              onChange={(e) => setNewFenceId(e.target.value)}
              placeholder="Geofence ID"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white font-mono"
            />
            <input
              type="number"
              value={newFenceRadius}
              onChange={(e) => setNewFenceRadius(Number(e.target.value))}
              placeholder="Radius (m)"
              className="w-28 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white font-mono"
            />
            <button
              onClick={handleAddGeofence}
              className="flex items-center justify-center gap-1 px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-500 active:scale-95 transition-all touch-press"
            >
              <Plus className="w-3.5 h-3.5" />
              Register Geofence
            </button>
          </div>
        </div>
      </div>

      {/* Camera Barcode / QR Code Scanner */}
      <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-bold text-white text-base">Asset Tag Scanner</h2>
              <p className="text-xs text-slate-400">Barcode, QR Code & Data Matrix Camera Reader</p>
            </div>
          </div>

          <button
            onClick={handleScanAssetTag}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs shadow-md shadow-amber-500/30 hover:brightness-110 active:scale-95 transition-all touch-press"
          >
            <QrCode className="w-3.5 h-3.5" />
            Scan Asset Tag
          </button>
        </div>

        {scannedAssetCode && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Decoded Equipment Asset Tag:</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                FORMAT: {scanType}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900 text-xs font-mono font-bold text-white">
              {scannedAssetCode}
            </div>
          </div>
        )}
      </div>

      {/* Audio Voice Memo Recording & Sandboxed FS */}
      <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-bold text-white text-base">Audio Voice Memos & Logs</h2>
              <p className="text-xs text-slate-400">Recorded and Persisted in Sandboxed Filesystem</p>
            </div>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="p-4 rounded-xl bg-slate-950 border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleToggleRecord}
              className={`p-3 rounded-full transition-all touch-press ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40'
                  : 'bg-amber-500 text-slate-950 hover:brightness-110 shadow-lg shadow-amber-500/30'
              }`}
            >
              {isRecording ? <Square className="w-5 h-5 fill-white" /> : <Mic className="w-5 h-5" />}
            </button>
            <div>
              <div className="text-xs font-bold text-white">
                {isRecording ? `Recording Audio Memo (0:${recordSeconds < 10 ? '0' : ''}${recordSeconds})` : 'Tap to Record Voice Note'}
              </div>
              <div className="text-[11px] text-slate-400">Encrypted on device • Audio stream buffer</div>
            </div>
          </div>

          <div className="flex-1 w-full sm:max-w-xs">
            <input
              type="text"
              value={memoNote}
              onChange={(e) => setMemoNote(e.target.value)}
              placeholder="Memo title / work note"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs text-white"
            />
          </div>
        </div>

        {/* Saved Memos List */}
        <div className="space-y-2">
          {savedMemos.map((memo) => (
            <div
              key={memo.id}
              className="p-3 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePlayAudio(memo.id)}
                  className="p-2 rounded-lg bg-slate-900 text-amber-400 hover:bg-slate-800 active:scale-95 transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-amber-400" />
                </button>
                <div>
                  <div className="font-semibold text-white">{memo.title}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {memo.duration} • {memo.size} • {memo.timestamp}
                  </div>
                </div>
              </div>

              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono">
                FS_SAVED
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
