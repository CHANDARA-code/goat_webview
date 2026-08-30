import React from 'react';
import { useSimulator, GPS_PRESETS } from '../../context/SimulatorContext';
import type { PlatformType, ThemeType, NetworkType, BiometricType, BiometricMockResult } from '../../types/simulator';
import styles from './DeviceSimulator.module.css';

export const MockHardwareControls: React.FC = () => {
  const { hardware, updateHardware, frameScale, setFrameScale, triggerBiometrics, triggerHaptic, callBridge } = useSimulator();

  const handlePresetGpsChange = (presetKey: string) => {
    if (presetKey === 'custom') return;
    const preset = GPS_PRESETS[presetKey];
    if (preset) {
      updateHardware('gps', preset);
      callBridge('SET_MOCK_LOCATION', preset, 'Geolocation');
    }
  };

  return (
    <div className={styles.controlsPanel} data-testid="mock-hardware-controls">
      {/* 1. PLATFORM & DEVICE ERGONOMICS */}
      <div className={styles.controlSection}>
        <div className={styles.sectionHeader}>
          <span>📱</span>
          <span>Device Platform & Display</span>
        </div>

        <div className={styles.row}>
          <div className={styles.buttonGroup}>
            <button
              className={`${styles.toggleBtn} ${hardware.platform === 'ios' ? styles.active : ''}`}
              onClick={() => {
                updateHardware('platform', 'ios');
                callBridge('GET_DEVICE_INFO', { platform: 'ios' }, 'Hardware');
              }}
              data-testid="platform-ios-toggle"
            >
              iPhone 16 Pro
            </button>
            <button
              className={`${styles.toggleBtn} ${hardware.platform === 'android' ? styles.active : ''}`}
              onClick={() => {
                updateHardware('platform', 'android');
                callBridge('GET_DEVICE_INFO', { platform: 'android' }, 'Hardware');
              }}
              data-testid="platform-android-toggle"
            >
              Pixel 9 Pro
            </button>
          </div>
        </div>

        <div className={styles.row}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Theme</div>
            <div className={styles.buttonGroup}>
              <button
                className={`${styles.toggleBtn} ${hardware.theme === 'dark' ? styles.active : ''}`}
                onClick={() => updateHardware('theme', 'dark')}
              >
                🌙 Dark
              </button>
              <button
                className={`${styles.toggleBtn} ${hardware.theme === 'light' ? styles.active : ''}`}
                onClick={() => updateHardware('theme', 'light')}
              >
                ☀️ Light
              </button>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Frame Size</div>
            <div className={styles.buttonGroup}>
              <button
                className={`${styles.toggleBtn} ${frameScale === 'compact' ? styles.active : ''}`}
                onClick={() => setFrameScale('compact')}
              >
                Small
              </button>
              <button
                className={`${styles.toggleBtn} ${frameScale === 'normal' ? styles.active : ''}`}
                onClick={() => setFrameScale('normal')}
              >
                Med
              </button>
              <button
                className={`${styles.toggleBtn} ${frameScale === 'large' ? styles.active : ''}`}
                onClick={() => setFrameScale('large')}
              >
                Large
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. GPS COORDINATE SIMULATOR */}
      <div className={styles.controlSection}>
        <div className={styles.sectionHeader}>
          <span>📍</span>
          <span>GPS Geolocation Spoofer</span>
        </div>

        <div className={styles.row}>
          <select
            className={styles.selectInput}
            onChange={(e) => handlePresetGpsChange(e.target.value)}
            defaultValue="sf"
          >
            <option value="sf">San Francisco (37.7749, -122.4194)</option>
            <option value="tokyo">Tokyo (35.6762, 139.6503)</option>
            <option value="london">London (51.5074, -0.1278)</option>
            <option value="paris">Paris (48.8566, 2.3522)</option>
            <option value="custom">-- Custom Coordinates --</option>
          </select>
        </div>

        <div className={styles.row}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Latitude</label>
            <input
              type="number"
              step="0.0001"
              value={hardware.gps.lat}
              onChange={(e) => {
                const lat = parseFloat(e.target.value) || 0;
                updateHardware('gps', { ...hardware.gps, lat, name: 'Custom' });
              }}
              style={{
                width: '100%',
                padding: '5px 8px',
                borderRadius: '4px',
                border: '1px solid #475569',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                fontSize: '11px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Longitude</label>
            <input
              type="number"
              step="0.0001"
              value={hardware.gps.lng}
              onChange={(e) => {
                const lng = parseFloat(e.target.value) || 0;
                updateHardware('gps', { ...hardware.gps, lng, name: 'Custom' });
              }}
              style={{
                width: '100%',
                padding: '5px 8px',
                borderRadius: '4px',
                border: '1px solid #475569',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                fontSize: '11px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ width: '70px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Accuracy</label>
            <input
              type="number"
              min={1}
              max={100}
              value={hardware.gps.accuracy}
              onChange={(e) => {
                const accuracy = parseInt(e.target.value, 10) || 5;
                updateHardware('gps', { ...hardware.gps, accuracy });
              }}
              style={{
                width: '100%',
                padding: '5px 8px',
                borderRadius: '4px',
                border: '1px solid #475569',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                fontSize: '11px',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* 3. BATTERY & CHARGING */}
      <div className={styles.controlSection}>
        <div className={styles.sectionHeader}>
          <span>🔋</span>
          <span>Battery & Power State</span>
        </div>

        <div className={styles.row}>
          <div className={styles.sliderContainer}>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={hardware.battery.level}
              onChange={(e) => {
                const level = parseInt(e.target.value, 10);
                updateHardware('battery', {
                  ...hardware.battery,
                  level,
                  isLow: level <= 20,
                });
                callBridge('GET_DEVICE_INFO', { batteryLevel: level }, 'Hardware');
              }}
              className={styles.rangeInput}
            />
            <span className={styles.valueBadge}>{hardware.battery.level}%</span>
          </div>
        </div>

        <div className={styles.row}>
          <button
            className={`${styles.toggleBtn} ${hardware.battery.charging ? styles.active : ''}`}
            onClick={() => {
              const newCharging = !hardware.battery.charging;
              updateHardware('battery', { ...hardware.battery, charging: newCharging });
              callBridge('BATTERY_CHARGING_CHANGED', { charging: newCharging }, 'Hardware');
            }}
            style={{
              background: hardware.battery.charging ? '#10b981' : '#334155',
              color: '#ffffff',
              padding: '6px',
            }}
          >
            {hardware.battery.charging ? '⚡ Charging Cable Plugged In' : '🔋 Running on Battery'}
          </button>
        </div>
      </div>

      {/* 4. NETWORK & SYNTHETIC LATENCY */}
      <div className={styles.controlSection}>
        <div className={styles.sectionHeader}>
          <span>📶</span>
          <span>Network & Latency Simulator</span>
        </div>

        <div className={styles.row}>
          <div className={styles.buttonGroup}>
            {(['wifi', '5g', '4g', '3g', 'offline'] as NetworkType[]).map((net) => (
              <button
                key={net}
                className={`${styles.toggleBtn} ${hardware.network.type === net ? styles.active : ''}`}
                onClick={() => {
                  updateHardware('network', { ...hardware.network, type: net });
                  callBridge('NETWORK_TYPE_CHANGED', { networkType: net }, 'Network');
                }}
              >
                {net.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.row}>
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
              <span>Synthetic Thread Latency</span>
              <span>{hardware.network.latencyMs} ms</span>
            </div>
            <div className={styles.sliderContainer}>
              <input
                type="range"
                min={0}
                max={500}
                step={10}
                value={hardware.network.latencyMs}
                onChange={(e) => {
                  updateHardware('network', {
                    ...hardware.network,
                    latencyMs: parseInt(e.target.value, 10),
                  });
                }}
                className={styles.rangeInput}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 5. BIOMETRICS SIMULATION TOGGLE */}
      <div className={styles.controlSection}>
        <div className={styles.sectionHeader}>
          <span>🔐</span>
          <span>Biometric Sensor Mocking</span>
        </div>

        <div className={styles.row}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Biometry Type</label>
            <select
              className={styles.selectInput}
              value={hardware.biometrics.biometryType}
              onChange={(e) => {
                updateHardware('biometrics', {
                  ...hardware.biometrics,
                  biometryType: e.target.value as BiometricType,
                });
              }}
            >
              <option value="face">Face ID (iOS / Android)</option>
              <option value="touch">Touch ID / Fingerprint</option>
              <option value="biometric_prompt">BiometricPrompt (Class 3)</option>
              <option value="none">Disabled / Not Supported</option>
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Mock Outcome</label>
            <div className={styles.buttonGroup}>
              <button
                className={`${styles.toggleBtn} ${hardware.biometrics.mockResult === 'success' ? styles.active : ''}`}
                onClick={() =>
                  updateHardware('biometrics', { ...hardware.biometrics, mockResult: 'success' })
                }
                style={hardware.biometrics.mockResult === 'success' ? { background: '#10b981' } : {}}
              >
                Pass
              </button>
              <button
                className={`${styles.toggleBtn} ${hardware.biometrics.mockResult === 'fail' ? styles.active : ''}`}
                onClick={() =>
                  updateHardware('biometrics', { ...hardware.biometrics, mockResult: 'fail' })
                }
                style={hardware.biometrics.mockResult === 'fail' ? { background: '#ef4444' } : {}}
              >
                Fail
              </button>
              <button
                className={`${styles.toggleBtn} ${hardware.biometrics.mockResult === 'locked' ? styles.active : ''}`}
                onClick={() =>
                  updateHardware('biometrics', { ...hardware.biometrics, mockResult: 'locked' })
                }
                style={hardware.biometrics.mockResult === 'locked' ? { background: '#f59e0b' } : {}}
              >
                Lock
              </button>
            </div>
          </div>
        </div>

        <div className={styles.row} style={{ marginTop: '8px' }}>
          <button
            onClick={() => {
              triggerHaptic('medium');
              triggerBiometrics('Verify transaction authorization of $199.00');
            }}
            style={{
              width: '100%',
              padding: '7px 12px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#6366f1',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>✨</span>
            <span>Trigger Mock Biometric Verification</span>
          </button>
        </div>
      </div>
    </div>
  );
};
