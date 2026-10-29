import React, { useEffect, useRef, useState } from 'react';
import {
  RotateRightOutlined,
  ReloadOutlined,
  AppleOutlined,
  AndroidOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { Select, Segmented, Tooltip, Button } from 'antd';
import { DeviceOptions, DeviceName } from 'react-mockframe';
import { useSimulator } from '../../context/SimulatorContext';
import { DeviceFrame, AVAILABLE_DEVICES } from '../DeviceSimulator/DeviceFrame';
import { PreviewFrame } from '../CodePlayground';
import { DeviceScreenContent } from '../DeviceSimulator/DeviceScreenContent';
import styles from './Workspace.module.css';

const FIT_ZOOM = 0;
const FRAME_BEZEL_X = 32;
const FRAME_BEZEL_Y = 31;
const CANVAS_PADDING = 16;
const MIN_FIT_SCALE = 0.25;
const MAX_FIT_SCALE = 1.5;
const FALLBACK_FIT_SCALE = 0.6;

interface RightPreviewProps {
  platform: 'ios' | 'android' | 'web';
  setPlatform: (p: 'ios' | 'android' | 'web') => void;
  device: string;
  setDevice: (d: string) => void;
  deviceColor: string;
  setDeviceColor: (c: string) => void;
  landscape: boolean;
  setLandscape: (l: boolean | ((prev: boolean) => boolean)) => void;
  zoom: number;
  setZoom: (z: number) => void;
  width: number;
  onResizeWidth: (w: number) => void;
}

export const RightPreview: React.FC<RightPreviewProps> = ({
  platform,
  setPlatform,
  device,
  setDevice,
  deviceColor,
  setDeviceColor,
  landscape,
  setLandscape,
  zoom,
  setZoom,
  width,
  onResizeWidth,
}) => {
  const { playgroundCode, playgroundRunKey, runPlayground, updateHardware, activeWidgetTab } = useSimulator();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(FALLBACK_FIT_SCALE);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;

    const recompute = () => {
      const spec = DeviceOptions[device as DeviceName];
      if (!spec) return;
      const portraitW = spec.width + FRAME_BEZEL_X;
      const portraitH = spec.height + FRAME_BEZEL_Y;
      const naturalW = landscape ? portraitH : portraitW;
      const naturalH = landscape ? portraitW : portraitH;
      const availableW = canvas.clientWidth - CANVAS_PADDING * 2;
      const availableH = canvas.clientHeight - CANVAS_PADDING * 2;
      if (availableW <= 0 || availableH <= 0) return;
      const next = Math.min(availableW / naturalW, availableH / naturalH);
      setFitScale(Math.max(MIN_FIT_SCALE, Math.min(MAX_FIT_SCALE, next)));
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [device, landscape]);

  const effectiveZoom = zoom === FIT_ZOOM ? fitScale : zoom;

  const handlePlatformChange = (val: 'ios' | 'android' | 'web') => {
    setPlatform(val);
    if (val === 'ios') {
      updateHardware('platform', 'ios');
      setDevice('iPhone 18 Pro');
    } else if (val === 'android') {
      updateHardware('platform', 'android');
      setDevice('Pixel 10');
    } else {
      setDevice('MacBook Pro');
    }
  };

  const currentDeviceColors = (DeviceOptions[device as DeviceName]?.colors as readonly string[]) || [];

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const delta = startX - moveEvt.clientX;
      const nextW = Math.max(340, Math.min(680, startW + delta));
      onResizeWidth(nextW);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleKeyDownResizer = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onResizeWidth(Math.min(680, width + 20));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onResizeWidth(Math.max(340, width - 20));
    }
  };

  const filteredDevices = AVAILABLE_DEVICES.filter((d) => d.platform === platform || platform === 'web');

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative' }}>
      {/* Resizer Splitter */}
      <div
        className={styles.splitterHorizontal}
        role="separator"
        tabIndex={0}
        aria-label="Resize preview pane"
        aria-valuenow={width}
        aria-valuemin={340}
        aria-valuemax={680}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDownResizer}
      />

      <section
        className={styles.previewPane}
        style={{ width }}
        aria-label="Device Simulation Preview Pane"
      >
        {/* Preview Toolbar */}
        <div className={styles.previewToolbar}>
          <Segmented
            size="small"
            value={platform}
            onChange={(val) => handlePlatformChange(val as any)}
            options={[
              { value: 'ios', icon: <AppleOutlined />, label: 'iOS' },
              { value: 'android', icon: <AndroidOutlined />, label: 'Android' },
              { value: 'web', icon: <GlobalOutlined />, label: 'Web' },
            ]}
          />

          <Select
            size="small"
            style={{ width: 140 }}
            value={device}
            onChange={(d) => {
              setDevice(d);
              const cols = DeviceOptions[d as DeviceName]?.colors || [];
              if (cols.length > 0) {
                setDeviceColor(cols[0]);
              }
            }}
            options={filteredDevices.map((d) => ({ value: d.name, label: d.name }))}
            aria-label="Select Device Model"
          />

          {currentDeviceColors.length > 0 && (
            <Select
              size="small"
              style={{ width: 90 }}
              value={deviceColor}
              onChange={setDeviceColor}
              options={currentDeviceColors.map((c) => ({ value: c, label: c }))}
              aria-label="Select Device Color"
            />
          )}

          <Tooltip title="Rotate device orientation">
            <Button
              size="small"
              icon={<RotateRightOutlined />}
              onClick={() => setLandscape((prev) => !prev)}
              aria-label="Rotate Orientation"
            />
          </Tooltip>

          <Select
            size="small"
            style={{ width: 75 }}
            value={zoom}
            onChange={setZoom}
            options={[
              { value: FIT_ZOOM, label: 'Fit' },
              { value: 0.5, label: '50%' },
              { value: 0.75, label: '75%' },
              { value: 1.0, label: '100%' },
              { value: 1.25, label: '125%' },
            ]}
            aria-label="Preview Zoom Factor"
          />

          <Tooltip title="Reload Preview Frame">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={runPlayground}
              aria-label="Reload Frame"
            />
          </Tooltip>
        </div>

        {/* Device Frame Viewport */}
        <div className={styles.previewCanvasWrapper} ref={canvasRef}>
          <div style={{ zoom: effectiveZoom }}>
            <DeviceFrame
              device={device as any}
              deviceColor={deviceColor}
              landscape={landscape}
              zoom={1}
            >
              {activeWidgetTab === 'playground' ? (
                <PreviewFrame code={playgroundCode} key={playgroundRunKey} />
              ) : (
                <DeviceScreenContent />
              )}
            </DeviceFrame>
          </div>
        </div>
      </section>
    </div>
  );
};

export default RightPreview;
