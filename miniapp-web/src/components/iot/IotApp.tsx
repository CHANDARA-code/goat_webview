import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Bluetooth,
  Radio,
  Activity,
  RefreshCw,
  Sliders,
  Send,
  Play,
  Square,
  Rotate3d,
  Disc
} from 'lucide-react';
import { bridge } from '../../miniapp-bridge';
import { BleDevice, DeviceMotionData, NfcTagResult } from '../../types';

export const IotApp: React.FC = () => {
  // BLE state
  const [isScanningBle, setIsScanningBle] = useState(false);
  const [bleDevices, setBleDevices] = useState<BleDevice[]>([
    { deviceId: '00:1A:7D:DA:71:13', name: 'Goat Beacon Node #1', rssi: -48, isConnectable: true },
    { deviceId: 'AA:BB:CC:11:22:33', name: 'Smart Environmental Sensor', rssi: -62, isConnectable: true },
    { deviceId: '54:E1:AD:88:99:00', name: 'POS Card Reader Terminal', rssi: -35, isConnectable: true }
  ]);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  const [characteristicValue, setCharacteristicValue] = useState<string>('98.4% (Battery)');
  const [writePayload, setWritePayload] = useState<string>('LED_MODE_PULSE_FAST');
  const [bleStatusMsg, setBleStatusMsg] = useState<string | null>(null);

  // NFC state
  const [isReadingNfc, setIsReadingNfc] = useState(false);
  const [nfcTagResult, setNfcTagResult] = useState<NfcTagResult | null>({
    type: 'NDEF_TEXT_URI',
    payload: 'https://goat.io/device/provision/v2?node=991',
    uri: 'https://goat.io/device/provision/v2?node=991'
  });
  const [nfcWriteText, setNfcWriteText] = useState('https://goat.io/superapp/auth/key_902');
  const [nfcStatusMsg, setNfcStatusMsg] = useState<string | null>(null);

  // 3D Motion Orientation state
  const [isMotionTracking, setIsMotionTracking] = useState(false);
  const [motionData, setMotionData] = useState<DeviceMotionData>({
    alpha: 45, // Z
    beta: 15,  // X
    gamma: -10, // Y
    acceleration: { x: 0.12, y: -0.05, z: 9.81 },
    rotationRate: { alpha: 1.2, beta: 0.5, gamma: -0.8 },
    compassHeading: 315,
    timestamp: Date.now()
  });

  useEffect(() => {
    // Configure Native Navigation Bar for IoT Mini-App
    bridge.setNavBar({
      title: 'IoT & Hardware Hub',
      subtitle: 'BLE GATT, NFC & 3D Motion',
      backgroundColor: '#091528',
      textColor: '#38bdf8',
      isDark: true
    }).catch(() => {});

    // Listen to motion stream
    const unsubscribeMotion = bridge.onDeviceMotionChange((data) => {
      setMotionData(data);
    });

    return () => {
      unsubscribeMotion();
      bridge.stopDeviceMotion().catch(() => {});
    };
  }, []);

  // --- BLE Actions ---
  const handleToggleBleScan = async () => {
    try {
      if (isScanningBle) {
        await bridge.stopBleScan();
        setIsScanningBle(false);
        setBleStatusMsg('BLE scanning halted.');
      } else {
        await bridge.triggerImpact('medium');
        setIsScanningBle(true);
        setBleStatusMsg('Scanning for 2.4GHz BLE GATT peripherals...');
        const res = await bridge.startBleScan(8000);
        if (res?.devices && res.devices.length > 0) {
          setBleDevices(res.devices);
        }
        setTimeout(() => setIsScanningBle(false), 8000);
      }
    } catch (err: any) {
      setBleStatusMsg(`BLE Scan Error: ${err.message}`);
      setIsScanningBle(false);
    }
  };

  const handleConnectBle = async (device: BleDevice) => {
    try {
      await bridge.triggerImpact('heavy');
      setBleStatusMsg(`Connecting to GATT peripheral ${device.name} [${device.deviceId}]...`);
      const ok = await bridge.connectBle(device.deviceId);
      if (ok) {
        setConnectedDeviceId(device.deviceId);
        setBleStatusMsg(`Connected to ${device.name} (GATT Service Discovered)`);
        await bridge.triggerNotification('success');
      }
    } catch (err: any) {
      setBleStatusMsg(`Connection Failed: ${err.message}`);
    }
  };

  const handleDisconnectBle = () => {
    setConnectedDeviceId(null);
    setBleStatusMsg('Disconnected from BLE peripheral.');
  };

  const handleReadCharacteristic = async () => {
    if (!connectedDeviceId) return;
    try {
      await bridge.triggerImpact('light');
      const val = await bridge.readBleCharacteristic(
        connectedDeviceId,
        '00002a19-0000-1000-8000-00805f9b34fb' // Battery level characteristic UUID
      );
      setCharacteristicValue(val || '98% (Battery Telemetry)');
      setBleStatusMsg(`Read characteristic 0x2A19: ${val || '98%'}`);
    } catch (err: any) {
      setBleStatusMsg(`Read Error: ${err.message}`);
    }
  };

  const handleWriteCharacteristic = async () => {
    if (!connectedDeviceId) return;
    try {
      await bridge.triggerImpact('medium');
      await bridge.writeBleCharacteristic(
        connectedDeviceId,
        '0000fff1-0000-1000-8000-00805f9b34fb', // Custom control UUID
        writePayload
      );
      setBleStatusMsg(`Wrote "${writePayload}" to UUID 0xFFF1`);
      await bridge.triggerNotification('success');
    } catch (err: any) {
      setBleStatusMsg(`Write Error: ${err.message}`);
    }
  };

  // --- NFC Actions ---
  const handleReadNfc = async () => {
    setIsReadingNfc(true);
    setNfcStatusMsg('Hold NFC tag near the top antenna of your device...');
    try {
      await bridge.triggerImpact('medium');
      const tag = await bridge.readNfcTag();
      setNfcTagResult(tag);
      setNfcStatusMsg(`NFC NDEF Record Read: ${tag.payload}`);
      await bridge.triggerNotification('success');
    } catch (err: any) {
      setNfcStatusMsg(`NFC Error: ${err.message}`);
    } finally {
      setIsReadingNfc(false);
    }
  };

  const handleWriteNfc = async () => {
    if (!nfcWriteText.trim()) return;
    try {
      await bridge.triggerImpact('heavy');
      setNfcStatusMsg('Emitting NDEF payload to NFC tag...');
      const ok = await bridge.writeNfcTag(nfcWriteText.trim());
      if (ok) {
        setNfcStatusMsg(`Successfully wrote ${new Blob([nfcWriteText]).size} bytes to NFC Tag`);
        await bridge.triggerNotification('success');
      }
    } catch (err: any) {
      setNfcStatusMsg(`NFC Write Error: ${err.message}`);
    }
  };

  // --- 3D Motion Actions ---
  const handleToggleMotion = async () => {
    try {
      if (isMotionTracking) {
        await bridge.stopDeviceMotion();
        setIsMotionTracking(false);
      } else {
        await bridge.triggerImpact('medium');
        await bridge.startDeviceMotion({ interval: 'game' });
        setIsMotionTracking(true);
      }
    } catch (err) {
      console.error('Motion toggle error:', err);
    }
  };

  return (
    <div className="pb-24 pt-3 px-4 max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-cyan-950/70 via-slate-900/80 to-slate-950 border border-cyan-500/20 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 mb-2">
            <Cpu className="w-3.5 h-3.5" />
            Hardware & Sensor Subsystem
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            IoT & Hardware Telemetry Hub
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            Real-time Bluetooth Low Energy (BLE 5.3 GATT), NFC NDEF tag reader/writer, and 3D device motion orientation visualizer.
          </p>
        </div>
      </div>

      {/* 3D Motion Orientation Visualizer */}
      <div className="glass-card rounded-2xl p-5 border border-cyan-500/30 bg-gradient-to-br from-slate-900/90 to-cyan-950/40 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rotate3d className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="font-bold text-white text-base">3D Device Motion Orientation</h2>
              <p className="text-xs text-slate-400">Accelerometer, Gyroscope & Digital Compass</p>
            </div>
          </div>

          <button
            onClick={handleToggleMotion}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all touch-press active:scale-95 ${
              isMotionTracking
                ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30'
                : 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/30 hover:brightness-110'
            }`}
          >
            {isMotionTracking ? (
              <>
                <Square className="w-3.5 h-3.5" /> Stop Sensor
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Live Stream (100Hz)
              </>
            )}
          </button>
        </div>

        {/* 3D Virtual Device Perspective Model */}
        <div className="flex flex-col md:flex-row items-center gap-6 p-4 rounded-xl bg-slate-950/80 border border-white/5">
          {/* Interactive 3D Perspective Box */}
          <div className="w-48 h-48 flex items-center justify-center perspective-[600px]">
            <div
              className="w-28 h-44 rounded-2xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-indigo-600 border-2 border-white/40 shadow-2xl flex flex-col justify-between p-3 transition-transform duration-100 ease-out transform-gpu"
              style={{
                transform: `rotateX(${motionData.beta || 0}deg) rotateY(${motionData.gamma || 0}deg) rotateZ(${(motionData.alpha || 0) % 360}deg)`,
                transformStyle: 'preserve-3d',
                boxShadow: '0 20px 50px rgba(6, 182, 212, 0.4)'
              }}
            >
              <div className="flex justify-between items-center text-[10px] text-white/80 font-mono">
                <span>GOAT-3D</span>
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
              </div>
              <div className="text-center font-black text-white text-xs tracking-wider">
                GYRO HUB
              </div>
              <div className="flex justify-between items-center text-[9px] text-white/70 font-mono">
                <span>α:{Math.round(motionData.alpha || 0)}°</span>
                <span>β:{Math.round(motionData.beta || 0)}°</span>
              </div>
            </div>
          </div>

          {/* Sensor Gauges Grid */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
            <div className="p-3 rounded-xl bg-slate-900 border border-white/5 font-mono">
              <div className="text-[10px] text-slate-400">Pitch (Beta X)</div>
              <div className="text-lg font-black text-cyan-400">
                {(motionData.beta || 0).toFixed(1)}°
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-cyan-400 h-full transition-all"
                  style={{ width: `${Math.min(100, Math.abs(motionData.beta || 0) * 2)}%` }}
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-white/5 font-mono">
              <div className="text-[10px] text-slate-400">Roll (Gamma Y)</div>
              <div className="text-lg font-black text-sky-400">
                {(motionData.gamma || 0).toFixed(1)}°
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-sky-400 h-full transition-all"
                  style={{ width: `${Math.min(100, Math.abs(motionData.gamma || 0) * 2)}%` }}
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-white/5 font-mono">
              <div className="text-[10px] text-slate-400">Compass Heading</div>
              <div className="text-lg font-black text-indigo-400">
                {Math.round(motionData.compassHeading || 0)}° N
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-indigo-400 h-full transition-all"
                  style={{ width: `${((motionData.compassHeading || 0) / 360) * 100}%` }}
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-white/5 font-mono col-span-2 sm:col-span-3">
              <div className="text-[10px] text-slate-400">3-Axis Acceleration (m/s²)</div>
              <div className="flex gap-4 text-xs font-bold text-white mt-1">
                <span>X: <span className="text-cyan-300">{motionData.acceleration?.x?.toFixed(2) ?? '0.00'}</span></span>
                <span>Y: <span className="text-sky-300">{motionData.acceleration?.y?.toFixed(2) ?? '0.00'}</span></span>
                <span>Z: <span className="text-indigo-300">{motionData.acceleration?.z?.toFixed(2) ?? '9.81'}</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bluetooth Low Energy (BLE) Section */}
      <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bluetooth className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="font-bold text-white text-base">Bluetooth Low Energy (GATT)</h2>
              <p className="text-xs text-slate-400">Peripheral Discovery & Characteristic I/O</p>
            </div>
          </div>

          <button
            onClick={handleToggleBleScan}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all touch-press ${
              isScanningBle
                ? 'bg-blue-500 text-white animate-pulse'
                : 'bg-slate-800 text-slate-200 border border-white/10 hover:bg-slate-700'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanningBle ? 'animate-spin' : ''}`} />
            {isScanningBle ? 'Scanning...' : 'Scan Peripherals'}
          </button>
        </div>

        {/* Status notice */}
        {bleStatusMsg && (
          <div className="p-2.5 rounded-xl bg-slate-950 border border-blue-500/20 text-xs font-mono text-blue-300 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            {bleStatusMsg}
          </div>
        )}

        {/* Discovered Peripherals List */}
        <div className="space-y-2.5">
          {bleDevices.map((device) => {
            const isConnected = connectedDeviceId === device.deviceId;

            return (
              <div
                key={device.deviceId}
                className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isConnected
                    ? 'bg-blue-950/40 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                    : 'bg-slate-950/60 border-white/5 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <span>{device.name}</span>
                    {isConnected && (
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        CONNECTED
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    MAC: {device.deviceId} • RSSI: {device.rssi} dBm
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <button
                      onClick={handleDisconnectBle}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-500/30 active:scale-95 transition-all"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnectBle(device)}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 active:scale-95 transition-all touch-press"
                    >
                      Connect GATT
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Connected Peripheral Characteristic Inspector */}
        {connectedDeviceId && (
          <div className="p-4 rounded-xl bg-slate-950 border border-blue-500/30 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                GATT Service Inspector (UUID: 0x180F)
              </span>
              <span className="text-[10px] font-mono text-emerald-400">STATUS: MUTEX_ACQUIRED</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Read Characteristic */}
              <div className="p-3 rounded-lg bg-slate-900 border border-white/5 space-y-2">
                <div className="text-[11px] text-slate-400 font-mono">Battery Characteristic (0x2A19)</div>
                <div className="text-sm font-bold text-emerald-400 font-mono">
                  {characteristicValue}
                </div>
                <button
                  onClick={handleReadCharacteristic}
                  className="w-full py-1.5 rounded-lg bg-slate-800 text-xs text-slate-200 font-semibold hover:bg-slate-700 active:scale-95 transition-all"
                >
                  Read Telemetry
                </button>
              </div>

              {/* Write Characteristic */}
              <div className="p-3 rounded-lg bg-slate-900 border border-white/5 space-y-2">
                <div className="text-[11px] text-slate-400 font-mono">Control Command (0xFFF1)</div>
                <input
                  type="text"
                  value={writePayload}
                  onChange={(e) => setWritePayload(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-xs text-white font-mono"
                />
                <button
                  onClick={handleWriteCharacteristic}
                  className="w-full py-1.5 rounded-lg bg-blue-600 text-xs text-white font-bold hover:bg-blue-500 active:scale-95 transition-all flex items-center justify-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  Emit Payload
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Near Field Communication (NFC) Section */}
      <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-bold text-white text-base">Near Field Communication (NFC)</h2>
              <p className="text-xs text-slate-400">NDEF Tag Reading & Contactless Emission</p>
            </div>
          </div>

          <button
            onClick={handleReadNfc}
            disabled={isReadingNfc}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs shadow-md shadow-amber-500/30 hover:brightness-110 active:scale-95 transition-all touch-press disabled:opacity-50"
          >
            <Disc className={`w-3.5 h-3.5 ${isReadingNfc ? 'animate-spin' : ''}`} />
            {isReadingNfc ? 'Scanning Tag...' : 'Read NFC Tag'}
          </button>
        </div>

        {/* NFC Status message */}
        {nfcStatusMsg && (
          <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/20 text-xs font-mono text-amber-300">
            {nfcStatusMsg}
          </div>
        )}

        {/* Read Tag Output */}
        {nfcTagResult && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Last Scanned NDEF Record:</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                {nfcTagResult.type}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900 text-xs font-mono text-white break-all">
              {nfcTagResult.payload}
            </div>
          </div>
        )}

        {/* Write NFC Tag Form */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">
            Write Custom NDEF Record:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={nfcWriteText}
              onChange={(e) => setNfcWriteText(e.target.value)}
              placeholder="NDEF payload (URI or text)"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={handleWriteNfc}
              className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-500 active:scale-95 transition-all touch-press"
            >
              Write Tag
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
