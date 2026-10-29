import React from 'react';
import {
  Segmented,
  Select,
  InputNumber,
  Slider,
  Switch,
  Typography,
  Button,
} from 'antd';
import {
  MobileOutlined,
  EnvironmentOutlined,
  ThunderboltOutlined,
  WifiOutlined,
  LockOutlined,
  MoonOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { useSimulator, GPS_PRESETS } from '../../context/SimulatorContext';
import type { NetworkType, BiometricType } from '../../types/simulator';
import styles from './DeviceSimulator.module.css';

const { Text } = Typography;

export const MockHardwareControls: React.FC = () => {
  const {
    hardware,
    updateHardware,
    frameScale,
    setFrameScale,
    triggerBiometrics,
    triggerHaptic,
    callBridge,
  } = useSimulator();

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
          <Text strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MobileOutlined /> Device Platform & Display
          </Text>
        </div>

        <div className={styles.row} style={{ marginBottom: 8 }}>
          <Segmented
            block
            value={hardware.platform}
            onChange={(val) => {
              const platform = val as 'ios' | 'android';
              updateHardware('platform', platform);
              callBridge('GET_DEVICE_INFO', { platform }, 'Hardware');
            }}
            options={[
              { label: 'iPhone 16 Pro', value: 'ios' },
              { label: 'Pixel 9 Pro', value: 'android' },
            ]}
          />
        </div>

        <div className={styles.row} style={{ gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              Theme
            </Text>
            <Segmented
              block
              value={hardware.theme}
              onChange={(val) => updateHardware('theme', val as 'dark' | 'light')}
              options={[
                { label: 'Dark', value: 'dark', icon: <MoonOutlined /> },
                { label: 'Light', value: 'light', icon: <BulbOutlined /> },
              ]}
            />
          </div>

          <div style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              Frame Size
            </Text>
            <Segmented
              block
              value={frameScale}
              onChange={(val) => setFrameScale(val as 'compact' | 'normal' | 'large')}
              options={[
                { label: 'Small', value: 'compact' },
                { label: 'Med', value: 'normal' },
                { label: 'Large', value: 'large' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* 2. GPS COORDINATE SIMULATOR */}
      <div className={styles.controlSection}>
        <div className={styles.sectionHeader}>
          <Text strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <EnvironmentOutlined /> GPS Geolocation Spoofer
          </Text>
        </div>

        <div className={styles.row} style={{ marginBottom: 8 }}>
          <Select
            style={{ width: '100%' }}
            defaultValue="sf"
            onChange={handlePresetGpsChange}
            options={[
              { value: 'sf', label: 'San Francisco (37.7749, -122.4194)' },
              { value: 'tokyo', label: 'Tokyo (35.6762, 139.6503)' },
              { value: 'london', label: 'London (51.5074, -0.1278)' },
              { value: 'paris', label: 'Paris (48.8566, 2.3522)' },
              { value: 'custom', label: '-- Custom Coordinates --' },
            ]}
          />
        </div>

        <div className={styles.row} style={{ gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
              Latitude
            </Text>
            <InputNumber
              style={{ width: '100%' }}
              step={0.0001}
              value={hardware.gps.lat}
              onChange={(val) => {
                const lat = val ?? 0;
                updateHardware('gps', { ...hardware.gps, lat, name: 'Custom' });
              }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
              Longitude
            </Text>
            <InputNumber
              style={{ width: '100%' }}
              step={0.0001}
              value={hardware.gps.lng}
              onChange={(val) => {
                const lng = val ?? 0;
                updateHardware('gps', { ...hardware.gps, lng, name: 'Custom' });
              }}
            />
          </div>

          <div style={{ width: 80 }}>
            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
              Accuracy
            </Text>
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              max={100}
              value={hardware.gps.accuracy}
              onChange={(val) => {
                const accuracy = val ?? 5;
                updateHardware('gps', { ...hardware.gps, accuracy });
              }}
            />
          </div>
        </div>
      </div>

      {/* 3. BATTERY & CHARGING */}
      <div className={styles.controlSection}>
        <div className={styles.sectionHeader}>
          <Text strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ThunderboltOutlined /> Battery & Power State
          </Text>
        </div>

        <div className={styles.row} style={{ marginBottom: 8 }}>
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
              <Text type="secondary">Battery Level</Text>
              <Text style={{ color: 'var(--goat-success)', fontWeight: 600 }}>{hardware.battery.level}%</Text>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={hardware.battery.level}
              tooltip={{ formatter: (val) => `${val}%` }}
              onChange={(level) => {
                updateHardware('battery', {
                  ...hardware.battery,
                  level,
                  isLow: level <= 20,
                });
                callBridge('GET_DEVICE_INFO', { batteryLevel: level }, 'Hardware');
              }}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={hardware.battery.charging}
              checkedChildren={<ThunderboltOutlined />}
              unCheckedChildren={<ThunderboltOutlined />}
              onChange={(newCharging) => {
                updateHardware('battery', { ...hardware.battery, charging: newCharging });
                callBridge('BATTERY_CHARGING_CHANGED', { charging: newCharging }, 'Hardware');
              }}
            />
            <Text style={{ fontSize: 12 }}>
              {hardware.battery.charging ? 'Charging Cable Plugged In' : 'Running on Battery'}
            </Text>
          </div>
        </div>
      </div>

      {/* 4. NETWORK & SYNTHETIC LATENCY */}
      <div className={styles.controlSection}>
        <div className={styles.sectionHeader}>
          <Text strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <WifiOutlined /> Network & Latency Simulator
          </Text>
        </div>

        <div className={styles.row} style={{ marginBottom: 8 }}>
          <Segmented
            block
            value={hardware.network.type}
            onChange={(val) => {
              const net = val as NetworkType;
              updateHardware('network', { ...hardware.network, type: net });
              callBridge('NETWORK_TYPE_CHANGED', { networkType: net }, 'Network');
            }}
            options={[
              { label: 'WIFI', value: 'wifi' },
              { label: '5G', value: '5g' },
              { label: '4G', value: '4g' },
              { label: '3G', value: '3g' },
              { label: 'OFFLINE', value: 'offline' },
            ]}
          />
        </div>

        <div className={styles.row}>
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
              <Text type="secondary">Synthetic Thread Latency</Text>
              <Text>{hardware.network.latencyMs} ms</Text>
            </div>
            <Slider
              min={0}
              max={500}
              step={10}
              value={hardware.network.latencyMs}
              tooltip={{ formatter: (val) => `${val} ms` }}
              onChange={(latencyMs) => {
                updateHardware('network', {
                  ...hardware.network,
                  latencyMs,
                });
              }}
            />
          </div>
        </div>
      </div>

      {/* 5. BIOMETRICS SIMULATION TOGGLE */}
      <div className={styles.controlSection}>
        <div className={styles.sectionHeader}>
          <Text strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <LockOutlined /> Biometric Sensor Mocking
          </Text>
        </div>

        <div className={styles.row} style={{ gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
              Biometry Type
            </Text>
            <Select
              style={{ width: '100%' }}
              value={hardware.biometrics.biometryType}
              onChange={(val) => {
                updateHardware('biometrics', {
                  ...hardware.biometrics,
                  biometryType: val as BiometricType,
                });
              }}
              options={[
                { value: 'face', label: 'Face ID (iOS / Android)' },
                { value: 'touch', label: 'Touch ID / Fingerprint' },
                { value: 'biometric_prompt', label: 'BiometricPrompt (Class 3)' },
                { value: 'none', label: 'Disabled / Not Supported' },
              ]}
            />
          </div>

          <div style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
              Mock Outcome
            </Text>
            <Segmented
              block
              value={hardware.biometrics.mockResult}
              onChange={(val) =>
                updateHardware('biometrics', {
                  ...hardware.biometrics,
                  mockResult: val as 'success' | 'fail' | 'locked',
                })
              }
              options={[
                { label: 'Pass', value: 'success' },
                { label: 'Fail', value: 'fail' },
                { label: 'Lock', value: 'locked' },
              ]}
            />
          </div>
        </div>

        <div className={styles.row} style={{ marginTop: 8 }}>
          <Button
            type="primary"
            block
            icon={<ThunderboltOutlined />}
            onClick={() => {
              triggerHaptic('medium');
              triggerBiometrics('Verify transaction authorization of $199.00');
            }}
          >
            Trigger Mock Biometric Verification
          </Button>
        </div>
      </div>
    </div>
  );
};
