import React from 'react';
import { DeviceFrame } from './DeviceFrame';
import { MockHardwareControls } from './MockHardwareControls';
import styles from './DeviceSimulator.module.css';

interface DeviceSimulatorProps {
  showControls?: boolean;
}

export const DeviceSimulator: React.FC<DeviceSimulatorProps> = ({ showControls = true }) => {
  return (
    <div className={styles.simulatorContainer} data-testid="live-device-simulator">
      {/* 1. Interactive Mobile Frame (iPhone 16 Pro / Pixel 9 Pro) */}
      <DeviceFrame />

      {/* 2. Mock Hardware Controls Panel */}
      {showControls && <MockHardwareControls />}
    </div>
  );
};

export default DeviceSimulator;
