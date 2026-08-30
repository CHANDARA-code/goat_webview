import React from 'react';

interface DeviceFrameProps {
  platform: 'ios' | 'android';
  children?: React.ReactNode;
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '16px',
  },
  frame: {
    position: 'relative',
    width: '280px',
    height: '580px',
    borderRadius: '40px',
    border: '8px solid #1a1a2e',
    backgroundColor: '#ffffff',
    boxShadow: '0 0 0 2px #0d0d1a, 0 24px 48px rgba(0,0,0,0.45)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  iosTopBar: {
    position: 'relative',
    height: '40px',
    backgroundColor: '#1a1a2e',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  dynamicIsland: {
    width: '100px',
    height: '22px',
    backgroundColor: '#000000',
    borderRadius: '20px',
  },
  androidTopBar: {
    position: 'relative',
    height: '36px',
    backgroundColor: '#1a1a2e',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  punchHole: {
    width: '14px',
    height: '14px',
    backgroundColor: '#000000',
    borderRadius: '50%',
  },
  screen: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    overflow: 'hidden',
    position: 'relative',
  },
  bottomBar: {
    height: '30px',
    backgroundColor: '#1a1a2e',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  homeIndicatorIos: {
    width: '100px',
    height: '4px',
    backgroundColor: '#555577',
    borderRadius: '4px',
  },
  androidNavButtons: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
  },
  androidNavBtn: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#555577',
  },
  platformLabel: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    fontSize: '10px',
    fontWeight: 600,
    color: '#aaaacc',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    zIndex: 2,
  },
};

export function DeviceFrame({ platform, children }: DeviceFrameProps) {
  const isIos = platform === 'ios';

  return (
    <div style={styles.wrapper} data-testid="device-frame" data-platform={platform}>
      <div style={styles.frame}>
        <span style={styles.platformLabel}>{isIos ? 'iPhone 16 Pro' : 'Pixel 9 Pro'}</span>

        {/* Top bar — Dynamic Island (iOS) or Punch-hole camera (Android) */}
        {isIos ? (
          <div style={styles.iosTopBar} data-testid="dynamic-island-bar">
            <div style={styles.dynamicIsland} />
          </div>
        ) : (
          <div style={styles.androidTopBar} data-testid="punchhole-camera-bar">
            <div style={styles.punchHole} />
          </div>
        )}

        {/* Rendered mini-app content */}
        <div style={styles.screen}>{children}</div>

        {/* Bottom UI affordance */}
        <div style={styles.bottomBar}>
          {isIos ? (
            <div style={styles.homeIndicatorIos} />
          ) : (
            <div style={styles.androidNavButtons}>
              <div style={styles.androidNavBtn} />
              <div style={{ ...styles.androidNavBtn, borderRadius: '2px' }} />
              <div style={styles.androidNavBtn} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeviceFrame;
