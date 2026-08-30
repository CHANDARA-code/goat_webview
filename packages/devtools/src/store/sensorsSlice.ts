/**
 * @goat/devtools - Sensors & Hardware Zustand Slice
 * Live state synchronization with @goat/bridge-mock mockState and eventBus.
 */

import type { StateCreator } from 'zustand';
import { mockState } from '@goat/bridge-mock';
import type {
  SensorsSlice,
  DevToolsStore,
  NetworkPreset,
  NetworkProfileId,
  BlePeripheral,
  GpxPoint,
  DeviceMotionPreset,
} from '../types/index.ts';

// Helper to safely sync with bridge-mock mockState
function syncMockState(action: (state: typeof mockState) => void) {
  try {
    if (typeof mockState !== 'undefined' && mockState !== null) {
      action(mockState);
    }
  } catch {
    // Ignore in non-mock test environments
  }
}

export const createSensorsSlice: StateCreator<DevToolsStore, [], [], any> = (set, get) => ({
  accelerometer: { x: 0, y: 0, z: 9.81 },
  gyroscope: { x: 0, y: 0, z: 0, alpha: 0, beta: 0, gamma: 0 },
  compass: { direction: 0, accuracy: 65 },
  deviceMotion: { alpha: 0, beta: 0, gamma: 0 },
  activeMotionPreset: 'flat',
  location: {
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 10,
    accuracy: 5,
    speed: 0,
    heading: 0,
  },
  gpxRoute: {
    name: 'Default Track',
    points: [
      { lat: 37.7749, lng: -122.4194, ele: 10 },
      { lat: 37.7755, lng: -122.4182, ele: 12 },
      { lat: 37.7762, lng: -122.4170, ele: 14 },
      { lat: 37.7770, lng: -122.4155, ele: 15 },
    ],
    waypoints: [
      { latitude: 37.7749, longitude: -122.4194, elevation: 10 },
      { latitude: 37.7755, longitude: -122.4182, elevation: 12 },
      { latitude: 37.7762, longitude: -122.4170, elevation: 14 },
      { latitude: 37.7770, longitude: -122.4155, elevation: 15 },
    ],
    isPlaying: false,
    speedMultiplier: 1.0,
    currentIndex: 0,
    loop: false,
  },
  gpxPlayback: {
    isPlaying: false,
    speedMultiplier: 1.0,
    currentIndex: 0,
    loop: false,
  },
  networkThrottling: {
    preset: 'online',
    latencyMs: 0,
    downloadKbps: 100000,
    uploadKbps: 50000,
    packetLossRate: 0,
    isOffline: false,
  },
  networkProfileId: 'online',
  customNetwork: {
    id: 'custom',
    name: 'Custom',
    downloadKbps: 10000,
    uploadKbps: 5000,
    latencyMs: 50,
    packetLossPercent: 0,
  },
  battery: {
    level: 85,
    isCharging: false,
    chargingTime: 0,
    dischargingTime: 18000,
    chargingSource: 'usb',
  },
  brightness: {
    level: 0.8,
    autoAdjust: false,
  },
  screenBrightness: 0.8,
  biometricsMode: 'success',
  blePeripherals: [],
  nfcRecords: [],
  nfcTag: {
    id: '04:8A:2B:6F:4C:80',
    techList: ['android.nfc.tech.Ndef', 'android.nfc.tech.NfcA'],
    ndefMessage: 'https://goat.dev/app/demo',
  },
  biometrics: {
    type: 'faceId',
    isEnrolled: true,
    shouldSucceed: true,
    isModalOpen: false,
  },

  setAccelerometer: (accelerometer: any) => {
    set((state: any) => ({ accelerometer: { ...state.accelerometer, ...accelerometer } }));
  },

  setGyroscope: (gyroscope: any) => {
    set((state: any) => ({ gyroscope: { ...state.gyroscope, ...gyroscope } }));
  },

  setCompass: (compass: any) => {
    set((state: any) => ({ compass: { ...state.compass, ...compass } }));
  },

  setDeviceMotion: (deviceMotion: any) => {
    set((state: any) => ({ deviceMotion: { ...state.deviceMotion, ...deviceMotion } }));
  },

  setMotionPreset: (preset: DeviceMotionPreset | string) => {
    let acc = { x: 0, y: 0, z: 9.81 };
    let gyro = { x: 0, y: 0, z: 0, alpha: 0, beta: 0, gamma: 0 };

    switch (preset) {
      case 'shake':
        acc = { x: 28.5, y: -15.2, z: 12.0 };
        gyro = { x: 120, y: 85, z: -45, alpha: 180, beta: 45, gamma: -30 };
        break;
      case 'tilt-left':
      case 'tiltLeft':
        acc = { x: -6.9, y: 0, z: 6.9 };
        gyro = { x: 0, y: 0, z: 0, alpha: 0, beta: 0, gamma: -45 };
        break;
      case 'tilt-right':
      case 'tiltRight':
        acc = { x: 6.9, y: 0, z: 6.9 };
        gyro = { x: 0, y: 0, z: 0, alpha: 0, beta: 0, gamma: 45 };
        break;
      case 'face-down':
      case 'faceDown':
        acc = { x: 0, y: 0, z: -9.81 };
        gyro = { x: 0, y: 0, z: 0, alpha: 0, beta: 180, gamma: 0 };
        break;
      case 'freefall':
        acc = { x: 0, y: 0, z: 0.1 };
        gyro = { x: 0, y: 0, z: 0, alpha: 0, beta: 0, gamma: 0 };
        break;
      case 'flat':
      default:
        acc = { x: 0, y: 0, z: 9.81 };
        gyro = { x: 0, y: 0, z: 0, alpha: 0, beta: 0, gamma: 0 };
        break;
    }

    set({
      activeMotionPreset: preset,
      accelerometer: acc,
      gyroscope: gyro,
      deviceMotion: { alpha: gyro.alpha, beta: gyro.beta, gamma: gyro.gamma },
    });
  },

  setLocation: (data: any) => {
    set((state: any) => {
      const nextLocation = {
        ...state.location,
        ...data,
      };

      syncMockState((ms) => {
        if (ms.location) {
          if (data.latitude !== undefined) ms.location.latitude = data.latitude;
          if (data.longitude !== undefined) ms.location.longitude = data.longitude;
          if (data.altitude !== undefined) ms.location.altitude = data.altitude;
          if (data.accuracy !== undefined) ms.location.accuracy = data.accuracy;
          if (data.speed !== undefined) ms.location.speed = data.speed;
          if (data.heading !== undefined) ms.location.heading = data.heading;
        }
      });

      return { location: nextLocation };
    });
  },

  setGpxRoute: (pointsOrRoute: any) =>
    set((state: any) => {
      if (Array.isArray(pointsOrRoute)) {
        const waypoints = pointsOrRoute.map((p: any) => ({
          latitude: p.lat ?? p.latitude,
          longitude: p.lng ?? p.longitude,
          elevation: p.ele ?? p.elevation,
          time: p.time,
        }));
        return {
          gpxRoute: {
            ...state.gpxRoute,
            points: pointsOrRoute,
            waypoints,
            currentIndex: 0,
          },
        };
      } else if (pointsOrRoute && typeof pointsOrRoute === 'object') {
        const waypoints = pointsOrRoute.waypoints || [];
        const points = waypoints.map((w: any) => ({
          lat: w.latitude ?? w.lat,
          lng: w.longitude ?? w.lng,
          ele: w.elevation ?? w.ele,
          time: w.time,
        }));
        return {
          gpxRoute: {
            ...pointsOrRoute,
            points: points.length > 0 ? points : (pointsOrRoute.points || []),
            waypoints,
            isPlaying: state.gpxRoute?.isPlaying ?? false,
            speedMultiplier: state.gpxRoute?.speedMultiplier ?? 1.0,
            currentIndex: 0,
          },
        };
      }
      return { gpxRoute: { points: [], waypoints: [], isPlaying: false, speedMultiplier: 1.0, currentIndex: 0 } };
    }),

  setGpxRoutePoints: (points: GpxPoint[]) => {
    get().setGpxRoute(points);
  },

  setGpxPlaying: (isPlaying: boolean) =>
    set((state: any) => ({
      gpxRoute: { ...state.gpxRoute, isPlaying },
      gpxPlayback: { ...state.gpxPlayback, isPlaying },
    })),

  setGpxPlayback: (playback: any) =>
    set((state: any) => ({
      gpxPlayback: { ...state.gpxPlayback, ...playback },
      gpxRoute: { ...state.gpxRoute, ...playback },
    })),

  setGpxSpeed: (speedMultiplier: number) =>
    set((state: any) => ({
      gpxRoute: { ...state.gpxRoute, speedMultiplier },
      gpxPlayback: { ...state.gpxPlayback, speedMultiplier },
    })),

  setGpxSpeedMultiplier: (speedMultiplier: number) => {
    get().setGpxSpeed(speedMultiplier);
  },

  setGpxIndex: (currentIndex: number) =>
    set((state: any) => {
      const points = state.gpxRoute?.points || [];
      const point = points[currentIndex];
      const nextLoc = point
        ? {
            ...state.location,
            latitude: point.lat ?? point.latitude,
            longitude: point.lng ?? point.longitude,
            altitude: point.ele ?? point.elevation ?? state.location.altitude,
          }
        : state.location;

      if (point) {
        syncMockState((ms) => {
          if (ms.location) {
            ms.location.latitude = point.lat ?? point.latitude;
            ms.location.longitude = point.lng ?? point.longitude;
            if (point.ele !== undefined) ms.location.altitude = point.ele;
          }
        });
      }

      return {
        gpxRoute: { ...state.gpxRoute, currentIndex },
        gpxPlayback: { ...state.gpxPlayback, currentIndex },
        location: nextLoc,
      };
    }),

  setGpxCurrentIndex: (currentIndex: number) => {
    get().setGpxIndex(currentIndex);
  },

  setNetworkPreset: (preset: NetworkPreset | string) => {
    let net = {
      preset,
      latencyMs: 0,
      downloadKbps: 100000,
      uploadKbps: 50000,
      packetLossRate: 0,
      isOffline: false,
    };

    switch (preset) {
      case 'offline':
        net = { preset, latencyMs: 0, downloadKbps: 0, uploadKbps: 0, packetLossRate: 100, isOffline: true };
        break;
      case '2g':
        net = { preset, latencyMs: 400, downloadKbps: 250, uploadKbps: 50, packetLossRate: 2, isOffline: false };
        break;
      case '3g':
        net = { preset, latencyMs: 150, downloadKbps: 750, uploadKbps: 250, packetLossRate: 1, isOffline: false };
        break;
      case '4g':
        net = { preset, latencyMs: 40, downloadKbps: 20000, uploadKbps: 10000, packetLossRate: 0, isOffline: false };
        break;
      case '5g':
        net = { preset, latencyMs: 10, downloadKbps: 100000, uploadKbps: 50000, packetLossRate: 0, isOffline: false };
        break;
      case 'high-latency':
      case 'high_latency':
        net = { preset: 'high-latency', latencyMs: 800, downloadKbps: 1000, uploadKbps: 500, packetLossRate: 0.05, isOffline: false };
        break;
      case 'packet-loss':
      case 'packet_loss':
        net = { preset: 'packet-loss', latencyMs: 80, downloadKbps: 5000, uploadKbps: 2000, packetLossRate: 25, isOffline: false };
        break;
      case 'online':
      default:
        net = { preset: 'online', latencyMs: 0, downloadKbps: 100000, uploadKbps: 50000, packetLossRate: 0, isOffline: false };
        break;
    }

    syncMockState((ms) => {
      if (ms.network) {
        if (preset === 'offline') {
          ms.network.isConnected = false;
          ms.network.networkType = 'none';
        } else {
          ms.network.isConnected = true;
          ms.network.networkType = preset === 'online' ? 'wifi' : (preset as any);
        }
      }
    });

    set({
      networkProfileId: preset as NetworkProfileId,
      networkThrottling: net,
    });
  },

  setNetworkProfile: (profileId: NetworkProfileId | string) => {
    get().setNetworkPreset(profileId as NetworkPreset);
  },

  setNetworkCustom: (config: any) => {
    set((state: any) => {
      const customNetwork = { ...state.customNetwork, ...config };
      const networkThrottling = {
        ...state.networkThrottling,
        ...config,
        preset: 'custom',
        isOffline: false,
      };

      syncMockState((ms) => {
        if (ms.network) {
          ms.network.isConnected = true;
          ms.network.networkType = 'wifi';
        }
      });

      return {
        networkProfileId: 'custom',
        customNetwork,
        networkThrottling,
      };
    });
  },

  setCustomNetwork: (config: any) => {
    get().setNetworkCustom(config);
  },

  setCustomNetworkThrottling: (config: any) => {
    get().setNetworkCustom(config);
  },

  setBattery: (data: any) => {
    set((state: any) => {
      const nextBattery = { ...state.battery, ...data };
      syncMockState((ms) => {
        if (ms.battery) {
          if (data.level !== undefined) ms.battery.level = data.level;
          if (data.isCharging !== undefined) ms.battery.isCharging = data.isCharging;
        }
      });
      return { battery: nextBattery };
    });
  },

  setBrightness: (data: any) => {
    set((state: any) => {
      const level = data.level !== undefined ? Math.max(0, Math.min(1, data.level)) : state.screenBrightness;
      syncMockState((ms) => {
        ms.brightness = level;
      });
      return {
        brightness: { ...state.brightness, ...data, level },
        screenBrightness: level,
      };
    });
  },

  setScreenBrightness: (screenBrightness: number) => {
    const clamped = Math.max(0, Math.min(1, screenBrightness));
    syncMockState((ms) => {
      ms.brightness = clamped;
    });
    set({
      screenBrightness: clamped,
      brightness: { level: clamped, autoAdjust: false },
    });
  },

  setBiometricsMode: (mode: any) => {
    syncMockState((ms) => {
      if (ms.biometrics) {
        ms.biometrics.autoAuthSuccess = mode === 'success';
        ms.biometrics.isLockedOut = mode === 'lockout';
      }
      ms.permissions.set('BIOMETRIC', mode !== 'cancel');
    });
    set((state: any) => ({
      biometricsMode: mode,
      biometrics: { ...state.biometrics, shouldSucceed: mode === 'success' },
    }));
  },

  addBlePeripheral: (peripheral: BlePeripheral | any) => {
    set((state: any) => {
      const filtered = state.blePeripherals.filter((p: any) => p.id !== peripheral.id);
      const updated = [...filtered, peripheral];
      syncMockState((ms) => {
        ms.bleDevices = updated.map((p) => ({
          deviceId: p.id,
          name: p.name,
          rssi: p.rssi,
          isConnectable: true,
        }));
      });
      return { blePeripherals: updated };
    });
  },

  removeBlePeripheral: (id: string) => {
    set((state: any) => {
      const updated = state.blePeripherals.filter((p: any) => p.id !== id);
      syncMockState((ms) => {
        ms.bleDevices = updated.map((p) => ({
          deviceId: p.id,
          name: p.name,
          rssi: p.rssi,
          isConnectable: true,
        }));
        ms.connectedBleDevices.delete(id);
      });
      return { blePeripherals: updated };
    });
  },

  updateBlePeripheral: (id: string, updates: Partial<BlePeripheral>) => {
    set((state: any) => {
      const updated = state.blePeripherals.map((p: any) => (p.id === id ? { ...p, ...updates } : p));
      syncMockState((ms) => {
        ms.bleDevices = updated.map((p) => ({
          deviceId: p.id,
          name: p.name,
          rssi: p.rssi,
          isConnectable: true,
        }));
      });
      return { blePeripherals: updated };
    });
  },

  setBleConnected: (id: string, connected: boolean) => {
    syncMockState((ms) => {
      if (connected) {
        ms.connectedBleDevices.add(id);
      } else {
        ms.connectedBleDevices.delete(id);
      }
    });
    set((state: any) => ({
      blePeripherals: state.blePeripherals.map((p: any) =>
        p.id === id ? { ...p, isConnected: connected, connected } : p
      ),
    }));
  },

  addNfcRecord: (record: any) =>
    set((state: any) => ({ nfcRecords: [...state.nfcRecords, record] })),

  clearNfcRecords: () => set({ nfcRecords: [] }),

  setNfcTag: (nfcTag: any) => {
    syncMockState((ms) => {
      if (ms.nfcTag) {
        if (nfcTag.ndefMessage) {
          ms.nfcTag.payload = nfcTag.ndefMessage;
          ms.nfcTag.uri = nfcTag.ndefMessage;
        }
      }
    });
    set({ nfcTag });
  },

  setBiometrics: (data: any) => {
    set((state: any) => {
      const nextBio = { ...state.biometrics, ...data };
      syncMockState((ms) => {
        if (ms.biometrics) {
          if (data.type !== undefined) {
            ms.biometrics.biometryType =
              data.type === 'faceId' ? 'face' : data.type === 'fingerprint' || data.type === 'touchId' ? 'fingerprint' : 'none';
            ms.biometrics.supported = data.type !== 'none';
          }
          if (data.shouldSucceed !== undefined) {
            ms.biometrics.autoAuthSuccess = data.shouldSucceed;
          }
        }
        if (data.isEnrolled !== undefined) {
          ms.permissions.set('BIOMETRIC', data.isEnrolled);
        }
      });
      return { biometrics: nextBio };
    });
  },

  resetSensors: () => {
    syncMockState((ms) => {
      ms.reset();
    });
    set({
      accelerometer: { x: 0, y: 0, z: 9.81 },
      gyroscope: { x: 0, y: 0, z: 0, alpha: 0, beta: 0, gamma: 0 },
      compass: { direction: 0, accuracy: 65 },
      deviceMotion: { alpha: 0, beta: 0, gamma: 0 },
      activeMotionPreset: 'flat',
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: 10,
        accuracy: 5,
        speed: 0,
        heading: 0,
      },
      gpxRoute: {
        name: 'Default Track',
        points: [
          { lat: 37.7749, lng: -122.4194, ele: 10 },
          { lat: 37.7755, lng: -122.4182, ele: 12 },
          { lat: 37.7762, lng: -122.4170, ele: 14 },
          { lat: 37.7770, lng: -122.4155, ele: 15 },
        ],
        waypoints: [
          { latitude: 37.7749, longitude: -122.4194, elevation: 10 },
          { latitude: 37.7755, longitude: -122.4182, elevation: 12 },
          { latitude: 37.7762, longitude: -122.4170, elevation: 14 },
          { latitude: 37.7770, longitude: -122.4155, elevation: 15 },
        ],
        isPlaying: false,
        speedMultiplier: 1.0,
        currentIndex: 0,
        loop: false,
      },
      gpxPlayback: {
        isPlaying: false,
        speedMultiplier: 1.0,
        currentIndex: 0,
        loop: false,
      },
      networkThrottling: {
        preset: 'online',
        latencyMs: 0,
        downloadKbps: 100000,
        uploadKbps: 50000,
        packetLossRate: 0,
        isOffline: false,
      },
      networkProfileId: 'online',
      battery: {
        level: 85,
        isCharging: false,
        chargingTime: 0,
        dischargingTime: 18000,
        chargingSource: 'usb',
      },
      screenBrightness: 0.8,
      blePeripherals: [],
      nfcRecords: [],
      biometrics: {
        type: 'faceId',
        isEnrolled: true,
        shouldSucceed: true,
        isModalOpen: false,
      },
    });
  },
});
