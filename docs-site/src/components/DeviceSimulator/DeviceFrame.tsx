import React from 'react';
import { MockFrame, DeviceOptions, DeviceName } from 'react-mockframe';
import 'react-mockframe/styles/mockframe.css';
import { useSimulator } from '../../context/SimulatorContext';
import { DeviceScreenContent } from './DeviceScreenContent';
import styles from './DeviceSimulator.module.css';

export const DEVICE_OPTIONS = DeviceOptions;

export const AVAILABLE_DEVICES: Array<{ name: DeviceName; label: string; platform: 'ios' | 'android' | 'web' }> = [
  { name: 'iPhone 18 Pro', label: 'iPhone 18 Pro (Dynamic Island)', platform: 'ios' },
  { name: 'iPhone 17', label: 'iPhone 17', platform: 'ios' },
  { name: 'iPhone X', label: 'iPhone X', platform: 'ios' },
  { name: 'Pixel 10', label: 'Google Pixel 10 (Punch Hole)', platform: 'android' },
  { name: 'Galaxy S25', label: 'Samsung Galaxy S25', platform: 'android' },
  { name: 'iPad Pro', label: 'iPad Pro (12.9")', platform: 'ios' },
  { name: 'MacBook Pro', label: 'MacBook Pro Container', platform: 'web' },
];

export interface DeviceFrameProps {
  device?: DeviceName;
  deviceColor?: string;
  landscape?: boolean;
  zoom?: number;
  children?: React.ReactNode;
}

export const DeviceFrame: React.FC<DeviceFrameProps> = ({
  device: propDevice,
  deviceColor: propColor,
  landscape: propLandscape,
  zoom: propZoom,
  children,
}) => {
  const { hardware, isHapticRippling } = useSimulator();
  const isIos = hardware.platform === 'ios';

  const selectedDevice: DeviceName =
    propDevice || (isIos ? ('iPhone 18 Pro' as DeviceName) : ('Pixel 10' as DeviceName));

  const validColors = (DeviceOptions[selectedDevice]?.colors as readonly string[]) || [];
  const selectedColor =
    propColor && validColors.includes(propColor)
      ? propColor
      : validColors[0] || undefined;

  const isLandscape = !!propLandscape;
  const zoom = propZoom ?? 0.82;

  const screenContent = (
    <div
      className={`${styles.screen} ${hardware.theme === 'dark' ? styles.darkTheme : styles.lightTheme}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div className={styles.statusBar}>
        <span className={styles.statusTime}>9:41</span>
        <div className={styles.statusIcons}>
          <span>{hardware.network.type.toUpperCase()}</span>
          <span>
            {hardware.battery.charging ? '[C] ' : ''}
            {hardware.battery.level}%
          </span>
          <div
            style={{
              width: '20px',
              height: '10px',
              border: `1px solid ${hardware.theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.6)'}`,
              borderRadius: '3px',
              padding: '1px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${hardware.battery.level}%`,
                backgroundColor: hardware.battery.level > 20 ? 'var(--goat-success)' : 'var(--goat-error)',
                borderRadius: '1px',
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {children || <DeviceScreenContent />}
      </div>
    </div>
  );

  return (
    <div
      className={`${styles.frameWrapper} ${isHapticRippling ? styles.hapticVibration : ''}`}
      data-testid="device-frame"
      data-platform={hardware.platform}
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '12px 0',
      }}
    >
      {isHapticRippling && <div className={styles.rippleRing} />}

      <MockFrame
        device={selectedDevice as any}
        color={selectedColor as any}
        landscape={isLandscape}
        zoom={zoom}
        animated={true}
      >
        {screenContent}
      </MockFrame>
    </div>
  );
};

export default DeviceFrame;
