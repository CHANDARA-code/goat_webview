import React, { useState } from 'react';
import {
  InboxOutlined,
  LockOutlined,
  CameraOutlined,
  EnvironmentOutlined,
  BellOutlined,
  SafetyCertificateOutlined,
  WifiOutlined,
  ThunderboltOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useSimulator } from '../../context/SimulatorContext';
import { PreviewFrame } from '../CodePlayground';
import styles from './DeviceSimulator.module.css';

export const DeviceScreenContent: React.FC = () => {
  const {
    hardware,
    navBar,
    bottomSheet,
    setBottomSheet,
    permissionDialog,
    confirmPermissionStage1,
    respondPermissionSystemPrompt,
    setPermissionDialog,
    externalLinkDialog,
    confirmExternalLinkOpen,
    cancelExternalLink,
    setExternalLinkDialog,
    biometricsModal,
    activeWidgetTab,
    setActiveWidgetTab,
    triggerHaptic,
    triggerBiometrics,
    requestPermissionFlow,
    openExternalLinkFlow,
    callBridge,
    playgroundCode,
    playgroundRunKey,
  } = useSimulator();

  const isPlayground = activeWidgetTab === 'playground';

  const isIos = hardware.platform === 'ios';
  const isDark = hardware.theme === 'dark';
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleNavButtonClick = (btnId: string, text: string) => {
    triggerHaptic('selection');
    callBridge('NAV_BAR_BUTTON_CLICKED', { buttonId: btnId, title: text }, 'Navigation');
    showToast(`Navbar Action: ${text} (${btnId})`);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        position: 'relative',
        backgroundColor: 'var(--goat-bg-base)',
        color: 'var(--goat-text)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* 1. NATIVE NAVIGATION BAR */}
      <div
        style={{
          backgroundColor: navBar.backgroundColor,
          color: navBar.textColor,
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          position: 'relative',
          zIndex: 10,
          transition: 'background-color 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '36px' }}>
          {/* Left Action Button */}
          <div style={{ minWidth: '48px' }}>
            {navBar.leftButton && (
              <button
                onClick={() => handleNavButtonClick(navBar.leftButton!.id, navBar.leftButton!.text)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: navBar.textColor,
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '4px',
                }}
              >
                <span>‹</span>
                <span>{navBar.leftButton.text}</span>
              </button>
            )}
          </div>

          {/* Center Title & Subtitle */}
          <div style={{ textAlign: 'center', flex: 1, padding: '0 4px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {navBar.title}
            </div>
            {navBar.subtitle && (
              <div style={{ fontSize: '10px', opacity: 0.8, fontWeight: 500 }}>
                {navBar.subtitle}
              </div>
            )}
          </div>

          {/* Right Action Buttons */}
          <div style={{ display: 'flex', gap: '4px', minWidth: '48px', justifyContent: 'flex-end' }}>
            {navBar.rightButtons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => handleNavButtonClick(btn.id, btn.text)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: navBar.textColor,
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 7px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {btn.text}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        {navBar.progress.visible && (
          <div
            style={{
              height: '3px',
              width: '100%',
              backgroundColor: 'rgba(255,255,255,0.2)',
              marginTop: '4px',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${navBar.progress.percent}%`,
                backgroundColor: 'var(--goat-primary)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        )}
      </div>

      {/* 2. MINI-APP SCREEN BODY */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: isPlayground ? 'hidden' : 'auto',
          padding: isPlayground ? 0 : '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {isPlayground ? (
          <PreviewFrame key={playgroundRunKey} code={playgroundCode} />
        ) : (
          <>
        {/* Offline Banner */}
        {hardware.network.type === 'offline' && (
          <div
            style={{
              padding: '6px 12px',
              background: 'var(--goat-error)',
              color: 'var(--goat-text-light-solid)',
              fontSize: '11px',
              fontWeight: 700,
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              animation: 'pulse 1.5s infinite',
            }}
          >
            <span><WifiOutlined /> Device is Offline</span>
          </div>
        )}

        {/* Quick Component Launch Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--goat-text-secondary)' }}>
            Goat Native Capabilities
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              onClick={() => {
                triggerHaptic('light');
                setBottomSheet((prev) => ({ ...prev, isOpen: true }));
                callBridge('BOTTOM_SHEET_OPEN', { height: 380, snapIndex: 1 }, 'UI Sheet');
              }}
              style={{
                padding: '10px 8px',
                borderRadius: '8px',
                border: '1px solid var(--goat-border)',
                background: 'var(--goat-bg-container)',
                color: 'var(--goat-text)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '16px' }}><InboxOutlined /></span>
              <span>Bottom Sheet</span>
              <span style={{ fontSize: '9px', color: 'var(--goat-text-tertiary)', fontWeight: 400 }}>Interactive modal sheet</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic('medium');
                triggerBiometrics('Verify payment authorization');
              }}
              style={{
                padding: '10px 8px',
                borderRadius: '8px',
                border: '1px solid var(--goat-border)',
                background: 'var(--goat-bg-container)',
                color: 'var(--goat-text)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '16px' }}><LockOutlined /></span>
              <span>Biometrics</span>
              <span style={{ fontSize: '9px', color: 'var(--goat-text-tertiary)', fontWeight: 400 }}>FaceID / BiometricPrompt</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic('selection');
                requestPermissionFlow('camera');
              }}
              style={{
                padding: '10px 8px',
                borderRadius: '8px',
                border: '1px solid var(--goat-border)',
                background: 'var(--goat-bg-container)',
                color: 'var(--goat-text)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '16px' }}><CameraOutlined /></span>
              <span>Permissions</span>
              <span style={{ fontSize: '9px', color: 'var(--goat-text-tertiary)', fontWeight: 400 }}>2-Stage rationale priming</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic('selection');
                openExternalLinkFlow('https://checkout.stripe.com/pay/cs_goat_99');
              }}
              style={{
                padding: '10px 8px',
                borderRadius: '8px',
                border: '1px solid var(--goat-border)',
                background: 'var(--goat-bg-container)',
                color: 'var(--goat-text)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '16px' }}><SafetyCertificateOutlined /></span>
              <span>External Link</span>
              <span style={{ fontSize: '9px', color: 'var(--goat-text-tertiary)', fontWeight: 400 }}>Anti-phishing verification</span>
            </button>
          </div>
        </div>

        {/* Live Mock Hardware Card */}
        <div
          style={{
            padding: '10px',
            borderRadius: '8px',
            background: 'var(--goat-fill-tertiary)',
            border: '1px solid var(--goat-border)',
            fontSize: '11px',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--goat-primary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Telemetry Sensor Data</span>
            <span style={{ fontSize: '10px', color: 'var(--goat-text-secondary)' }}>{isIos ? 'iOS 18.2' : 'Android 15'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '10px' }}>
            <div>GPS: <strong style={{ color: 'var(--goat-success)' }}>{hardware.gps.name?.split(',')[0] || 'Custom'}</strong></div>
            <div>Net: <strong style={{ color: 'var(--goat-primary)' }}>{hardware.network.type.toUpperCase()} ({hardware.network.latencyMs}ms)</strong></div>
            <div>Battery: <strong>{hardware.battery.level}% {hardware.battery.charging ? '[C]' : ''}</strong></div>
            <div>Bio: <strong style={{ color: hardware.biometrics.mockResult === 'success' ? 'var(--goat-success)' : 'var(--goat-error)' }}>{hardware.biometrics.mockResult.toUpperCase()}</strong></div>
          </div>
        </div>

        {/* Interactive Haptic Triggers in Viewport */}
        <div
          style={{
            padding: '10px',
            borderRadius: '8px',
            background: 'var(--goat-bg-container)',
            border: '1px solid var(--goat-border)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>Haptic Feedback Triggers</div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {(['light', 'medium', 'heavy', 'success', 'warning', 'error'] as const).map((type) => (
              <button
                key={type}
                onClick={() => triggerHaptic(type)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  background: type === 'success' ? 'var(--goat-success)' : type === 'error' ? 'var(--goat-error)' : type === 'warning' ? 'var(--goat-warning)' : 'var(--goat-primary)',
                  color: 'var(--goat-text-light-solid)',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
          </>
        )}
      </div>

      {/* 3. INTERACTIVE NATIVE BOTTOM SHEET */}
      {bottomSheet.isOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => {
            if (bottomSheet.isDismissible) {
              setBottomSheet((prev) => ({ ...prev, isOpen: false }));
              callBridge('BOTTOM_SHEET_CLOSE', {}, 'UI Sheet');
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--goat-bg-elevated)',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              padding: '12px 16px 24px 16px',
              maxHeight: `${bottomSheet.snapPoints[bottomSheet.currentSnapIndex] * 100}%`,
              minHeight: '220px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
              position: 'relative',
            }}
          >
            {/* Sheet Drag Handle */}
            <div
              style={{
                width: '40px',
                height: '4px',
                backgroundColor: 'var(--goat-border-strong)',
                borderRadius: '4px',
                margin: '0 auto 12px auto',
                cursor: 'grab',
              }}
            />

            {/* Sheet Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>Native Bottom Sheet</div>
              <button
                onClick={() => {
                  setBottomSheet((prev) => ({ ...prev, isOpen: false }));
                  callBridge('BOTTOM_SHEET_CLOSE', {}, 'UI Sheet');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--goat-text-secondary)',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>

            {/* Sheet Tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', borderBottom: '1px solid var(--goat-split)', paddingBottom: '6px' }}>
              {bottomSheet.tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setBottomSheet((prev) => ({ ...prev, activeTab: tab.id }));
                    callBridge('TAB_SWITCH', { tabId: tab.id }, 'UI Sheet');
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    background: bottomSheet.activeTab === tab.id ? 'var(--goat-primary)' : 'transparent',
                    color: bottomSheet.activeTab === tab.id ? 'var(--goat-text-on-primary)' : 'var(--goat-text-secondary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {tab.title}
                </button>
              ))}
            </div>

            {/* Sheet Tab Content */}
            <div style={{ fontSize: '12px', lineHeight: 1.4, color: 'var(--goat-text-secondary)', marginBottom: '16px' }}>
              {bottomSheet.tabs.find((t) => t.id === bottomSheet.activeTab)?.content}
            </div>

            {/* Snap Point Switcher */}
            <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
              <button
                onClick={() => {
                  setBottomSheet((prev) => ({ ...prev, currentSnapIndex: 0 }));
                  callBridge('COLLAPSE_BOTTOM_SHEET', { snapIndex: 0 }, 'UI Sheet');
                }}
                style={{
                  flex: 1,
                  padding: '6px',
                  borderRadius: '6px',
                  border: '1px solid var(--goat-border)',
                  background: bottomSheet.currentSnapIndex === 0 ? 'var(--goat-fill-secondary)' : 'transparent',
                  color: 'var(--goat-text)',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                25% (Peek)
              </button>
              <button
                onClick={() => {
                  setBottomSheet((prev) => ({ ...prev, currentSnapIndex: 1 }));
                  callBridge('BOTTOM_SHEET_SNAP', { snapIndex: 1 }, 'UI Sheet');
                }}
                style={{
                  flex: 1,
                  padding: '6px',
                  borderRadius: '6px',
                  border: '1px solid var(--goat-border)',
                  background: bottomSheet.currentSnapIndex === 1 ? 'var(--goat-fill-secondary)' : 'transparent',
                  color: 'var(--goat-text)',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                50% (Half)
              </button>
              <button
                onClick={() => {
                  setBottomSheet((prev) => ({ ...prev, currentSnapIndex: 2 }));
                  callBridge('EXPAND_BOTTOM_SHEET', { snapIndex: 2 }, 'UI Sheet');
                }}
                style={{
                  flex: 1,
                  padding: '6px',
                  borderRadius: '6px',
                  border: '1px solid var(--goat-border)',
                  background: bottomSheet.currentSnapIndex === 2 ? 'var(--goat-fill-secondary)' : 'transparent',
                  color: 'var(--goat-text)',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                90% (Full)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. PERMISSION 2-STAGE PRIMING DIALOG */}
      {permissionDialog.stage === 'priming' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--goat-bg-container)',
              borderRadius: '16px',
              padding: '18px',
              width: '100%',
              maxWidth: '260px',
              textAlign: 'center',
              boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>
              {permissionDialog.activePermission === 'camera' ? <CameraOutlined /> : permissionDialog.activePermission === 'location' ? <EnvironmentOutlined /> : <BellOutlined />}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
              Stage 1: Rationale Priming
            </div>
            <div style={{ fontSize: '11px', color: 'var(--goat-text-secondary)', lineHeight: 1.4, marginBottom: '14px' }}>
              To scan QR codes and authenticate merchant payments, Goat WebView requires access to your camera sensor.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                onClick={confirmPermissionStage1}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--goat-primary)',
                  color: 'var(--goat-text-on-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Enable Camera Access
              </button>
              <button
                onClick={() => setPermissionDialog((prev) => ({ ...prev, stage: 'idle' }))}
                style={{
                  padding: '6px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--goat-text-secondary)',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage 2: Native OS Permission Prompt */}
      {permissionDialog.stage === 'system_prompt' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            zIndex: 70,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--goat-bg-container)',
              borderRadius: isIos ? '14px' : '20px',
              padding: '16px',
              width: '100%',
              maxWidth: '250px',
              textAlign: 'center',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              border: '1px solid var(--goat-border)',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>
              {isIos ? '“Goat Mini App” Would Like to Access the Camera' : 'Allow Goat WebView to take pictures and record video?'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--goat-text-secondary)', marginBottom: '12px' }}>
              Required for fast barcode scanning & identity verification.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button
                onClick={() => respondPermissionSystemPrompt('granted')}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--goat-primary)',
                  color: 'var(--goat-text-on-primary)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isIos ? 'Allow While Using App' : 'While using the app'}
              </button>
              <button
                onClick={() => respondPermissionSystemPrompt('granted')}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  border: '1px solid var(--goat-border)',
                  background: 'transparent',
                  color: 'var(--goat-text)',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                {isIos ? 'Allow Once' : 'Only this time'}
              </button>
              <button
                onClick={() => respondPermissionSystemPrompt('denied')}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--goat-error)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Don’t Allow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. ANTI-PHISHING EXTERNAL LINK WARNING DIALOG */}
      {externalLinkDialog.isOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            zIndex: 65,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--goat-bg-container)',
              borderRadius: '14px',
              padding: '16px',
              width: '100%',
              maxWidth: '260px',
              textAlign: 'center',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              border: '1px solid var(--goat-error)',
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '6px' }}><SafetyCertificateOutlined /></div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--goat-error)', marginBottom: '4px' }}>
              External Domain Warning
            </div>
            <div style={{ fontSize: '10px', color: 'var(--goat-text-secondary)', marginBottom: '8px' }}>
              You are navigating outside the sandboxed mini-app domain:
            </div>
            <div
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                background: 'var(--goat-fill-tertiary)',
                fontFamily: 'monospace',
                fontSize: '10px',
                color: 'var(--goat-primary)',
                wordBreak: 'break-all',
                marginBottom: '10px',
              }}
            >
              {externalLinkDialog.destinationHost}
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '10px',
                color: 'var(--goat-text-secondary)',
                marginBottom: '12px',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={externalLinkDialog.dontAskAgainChecked}
                onChange={(e) =>
                  setExternalLinkDialog((prev) => ({ ...prev, dontAskAgainChecked: e.target.checked }))
                }
              />
              <span>Don’t warn again for this host</span>
            </label>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={cancelExternalLink}
                style={{
                  flex: 1,
                  padding: '7px',
                  borderRadius: '6px',
                  border: '1px solid var(--goat-border)',
                  background: 'transparent',
                  color: 'var(--goat-text-secondary)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmExternalLinkOpen}
                style={{
                  flex: 1,
                  padding: '7px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--goat-error)',
                  color: 'var(--goat-text-light-solid)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. BIOMETRICS SCANNER MODAL */}
      {biometricsModal.isOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--goat-bg-container)',
              borderRadius: '20px',
              padding: '20px',
              width: '100%',
              maxWidth: '240px',
              textAlign: 'center',
              boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor:
                  biometricsModal.state === 'matched'
                    ? 'var(--goat-success-bg)'
                    : biometricsModal.state === 'failed' || biometricsModal.state === 'locked'
                    ? 'var(--goat-error-bg)'
                    : 'var(--goat-primary-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                marginBottom: '12px',
                transition: 'all 0.3s ease',
              }}
            >
              {biometricsModal.state === 'matched'
                ? <CheckCircleOutlined />
                : biometricsModal.state === 'failed'
                ? <CloseCircleOutlined />
                : biometricsModal.state === 'locked'
                ? <LockOutlined />
                : isIos
                ? <UserOutlined />
                : <LockOutlined />}
            </div>

            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>
              {isIos ? 'Face ID' : 'BiometricPrompt'}
            </div>

            <div style={{ fontSize: '10px', color: 'var(--goat-text-secondary)', marginBottom: '8px' }}>
              {biometricsModal.reason}
            </div>

            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color:
                  biometricsModal.state === 'matched'
                    ? 'var(--goat-success)'
                    : biometricsModal.state === 'failed' || biometricsModal.state === 'locked'
                    ? 'var(--goat-error)'
                    : 'var(--goat-primary)',
              }}
            >
              {biometricsModal.state === 'scanning'
                ? 'Scanning Biometrics...'
                : biometricsModal.state === 'matched'
                ? 'Authenticated Successfully'
                : biometricsModal.state === 'locked'
                ? 'Authentication Locked Out'
                : 'Verification Failed'}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--goat-bg-elevated)',
            color: 'var(--goat-text)',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '10px',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 90,
            whiteSpace: 'nowrap',
            border: '1px solid var(--goat-border)',
          }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};
