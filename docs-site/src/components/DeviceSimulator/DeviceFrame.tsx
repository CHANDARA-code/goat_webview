import React from 'react';
import { useSimulator } from '../../context/SimulatorContext';
import { DeviceScreenContent } from './DeviceScreenContent';
import styles from './DeviceSimulator.module.css';

export const DeviceFrame: React.FC = () => {
  const { hardware, isHapticRippling, frameScale, biometricsModal, navBar } = useSimulator();
  const isIos = hardware.platform === 'ios';
  const isDynamicIslandExpanded = biometricsModal.isOpen || navBar.progress.visible;

  // Scale class mapping
  const scaleClass =
    frameScale === 'compact'
      ? styles.scaleCompact
      : frameScale === 'large'
      ? styles.scaleLarge
      : styles.scaleNormal;

  return (
    <div
      className={`${styles.frameWrapper} ${isHapticRippling ? styles.hapticVibration : ''}`}
      data-testid="device-frame"
      data-platform={hardware.platform}
    >
      {/* Visual Ripple Rings on Haptic Feedback */}
      {isHapticRippling && <div className={styles.rippleRing} />}

      {/* Physical Hardware Frame Chassis */}
      <div className={`${styles.chassis} ${scaleClass}`}>
        {/* Chassis Hardware Buttons (Left & Right) */}
        <div className={styles.hwButtonLeftAction} title="Action Button" />
        <div className={styles.hwButtonLeftVolUp} title="Volume Up" />
        <div className={styles.hwButtonLeftVolDown} title="Volume Down" />
        <div className={styles.hwButtonRightPower} title="Power / Lock Button" />

        {/* 1. TOP STATUS BAR */}
        <div className={styles.statusBar}>
          {/* Time */}
          <span className={styles.statusTime}>9:41</span>

          {/* iPhone 16 Pro Dynamic Island */}
          {isIos ? (
            <div
              className={`${styles.dynamicIsland} ${
                isDynamicIslandExpanded ? styles.dynamicIslandExpanded : ''
              }`}
              data-testid="dynamic-island"
            >
              <div className={styles.sensorDot} />
              {isDynamicIslandExpanded ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#38bdf8' }}>
                  <span>{biometricsModal.isOpen ? '🔐 FaceID' : '⚡ Goat Sync'}</span>
                </div>
              ) : null}
              <div className={styles.cameraLens} />
            </div>
          ) : (
            /* Pixel 9 Pro Punch Hole Camera */
            <div className={styles.punchHole} data-testid="punch-hole" />
          )}

          {/* Status Icons: Cellular, WiFi, Battery */}
          <div className={styles.statusIcons}>
            <span>{hardware.network.type === 'wifi' ? '📶' : hardware.network.type === '5g' ? '5G' : '4G'}</span>
            <span>{hardware.battery.charging ? '⚡' : ''}{hardware.battery.level}%</span>
            <div
              style={{
                width: '20px',
                height: '10px',
                border: '1px solid rgba(255,255,255,0.7)',
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
                  backgroundColor:
                    hardware.battery.level > 20
                      ? '#10b981'
                      : '#ef4444',
                  borderRadius: '1px',
                }}
              />
            </div>
          </div>
        </div>

        {/* 2. SCREEN VIEWPORT (MINI-APP CONTENT) */}
        <div className={`${styles.screen} ${hardware.theme === 'dark' ? styles.darkTheme : styles.lightTheme}`}>
          <DeviceScreenContent />
        </div>

        {/* 3. BOTTOM HOME BAR / NAVIGATION */}
        <div className={styles.bottomNav}>
          {isIos ? (
            <div className={styles.homeIndicatorIos} />
          ) : (
            <div className={styles.androidNavButtons}>
              <span className={styles.androidNavIcon}>◀</span>
              <span className={styles.androidNavIcon}>●</span>
              <span className={styles.androidNavIcon}>■</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
