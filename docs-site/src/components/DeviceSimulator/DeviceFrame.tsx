import React from 'react';
import { AndroidMockup, IPhoneMockup } from 'react-device-mockup';
import { useSimulator } from '../../context/SimulatorContext';
import { DeviceScreenContent } from './DeviceScreenContent';
import styles from './DeviceSimulator.module.css';

// react-device-mockup's `screenWidth` is the screen area only (bezel is added on top of
// it), so these are smaller than the old hand-rolled chassis widths (290/340/380) which
// included the bezel border. Chosen to preserve the same relative compact/normal/large
// proportions.
const SCREEN_WIDTH_BY_SCALE: Record<'compact' | 'normal' | 'large', number> = {
  compact: 270,
  normal: 315,
  large: 350,
};

const FRAME_COLOR = '#232733';

export const DeviceFrame: React.FC = () => {
  const { hardware, isHapticRippling, frameScale } = useSimulator();
  const isIos = hardware.platform === 'ios';
  const screenWidth = SCREEN_WIDTH_BY_SCALE[frameScale];

  // The real device notch/Dynamic Island/punch-hole cutout is now drawn by the mockup
  // library itself (via `screenType` / the Android camera cutout) instead of our old
  // hand-drawn `.dynamicIsland`/`.punchHole` divs. `hideStatusBar` folds that top strip
  // into the screen area so our own time/network/battery row can render there instead of
  // a blank placeholder bar — it deliberately leaves the center empty (`space-between`)
  // since that's where the real cutout sits.
  const screenContent = (
    <div
      className={`${styles.screen} ${hardware.theme === 'dark' ? styles.darkTheme : styles.lightTheme}`}
      style={{ width: '100%', height: '100%' }}
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
                backgroundColor: hardware.battery.level > 20 ? '#10b981' : '#ef4444',
                borderRadius: '1px',
              }}
            />
          </div>
        </div>
      </div>

      <DeviceScreenContent />
    </div>
  );

  return (
    <div
      className={`${styles.frameWrapper} ${isHapticRippling ? styles.hapticVibration : ''}`}
      data-testid="device-frame"
      data-platform={hardware.platform}
    >
      {/* Visual Ripple Rings on Haptic Feedback */}
      {isHapticRippling && <div className={styles.rippleRing} />}

      {isIos ? (
        <IPhoneMockup screenWidth={screenWidth} screenType="island" hideStatusBar frameColor={FRAME_COLOR}>
          {screenContent}
        </IPhoneMockup>
      ) : (
        <AndroidMockup screenWidth={screenWidth} navBar="swipe" hideStatusBar frameColor={FRAME_COLOR}>
          {screenContent}
        </AndroidMockup>
      )}
    </div>
  );
};
