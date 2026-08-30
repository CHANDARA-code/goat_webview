/**
 * @goat/bridge-mock - Domain 7: Location & Geofencing Handlers (7 Actions)
 */

import { mockState } from '../state/store.js';
import {
  LocationData,
  ChooseLocationResult,
  OpenLocationResult,
  GeofenceRegionResult,
  GeofenceTransitionResult,
} from '../types.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export class LocationHandlers {
  /**
   * Action 90: GET_LOCATION
   */
  public static getLocation(payload: any = {}): LocationData {
    if (!mockState.permissions.get('LOCATION')) {
      throw new GoatBridgeError(BridgeErrorCodes.PERMISSION_DENIED, 'Location permission denied by user');
    }
    if (!mockState.isUserGestureFresh(10000)) {
      throw new GoatBridgeError(
        BridgeErrorCodes.GESTURE_REQUIRED,
        'Privileged location request requires recent user touch interaction'
      );
    }

    const type = payload.type || 'wgs84';
    const loc = { ...mockState.location };

    // Coordinate conversion simulation if gcj02 requested
    if (type === 'gcj02') {
      loc.latitude += 0.0021;
      loc.longitude += 0.0034;
    }

    return loc;
  }

  /**
   * Action 91: CHOOSE_LOCATION
   */
  public static chooseLocation(): ChooseLocationResult {
    if (!mockState.permissions.get('LOCATION')) {
      throw new GoatBridgeError(BridgeErrorCodes.PERMISSION_DENIED, 'Location permission denied');
    }

    return {
      name: 'Goat Mini-App HQ',
      address: '1 Infinite Loop, Cupertino, CA 95014',
      latitude: mockState.location.latitude,
      longitude: mockState.location.longitude,
    };
  }

  /**
   * Action 92: OPEN_LOCATION
   */
  public static openLocation(payload: any = {}): OpenLocationResult {
    const latitude = typeof payload.latitude === 'number' ? payload.latitude : mockState.location.latitude;
    const longitude = typeof payload.longitude === 'number' ? payload.longitude : mockState.location.longitude;

    return {
      opened: true,
      latitude,
      longitude,
    };
  }

  /**
   * Action 93: START_GEOFENCE
   */
  public static startGeofence(payload: any = {}): { started: boolean; geofenceId: string; radiusMeters: number } {
    const geofenceId = payload.geofenceId;
    if (!geofenceId || typeof geofenceId !== 'string') {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "geofenceId"');
    }
    const latitude = typeof payload.latitude === 'number' ? payload.latitude : mockState.location.latitude;
    const longitude = typeof payload.longitude === 'number' ? payload.longitude : mockState.location.longitude;
    const radiusMeters = typeof payload.radiusMeters === 'number' ? payload.radiusMeters : 100;
    const transitionType = payload.transitionType || 'BOTH';

    const geofence: GeofenceRegionResult = {
      geofenceId,
      latitude,
      longitude,
      radiusMeters,
      transitionType,
    };

    mockState.geofences.set(geofenceId, geofence);
    return { started: true, geofenceId, radiusMeters };
  }

  /**
   * Action 94: STOP_GEOFENCE
   */
  public static stopGeofence(payload: any = {}): { stopped: boolean; geofenceId: string } {
    const geofenceId = payload.geofenceId;
    if (!geofenceId) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "geofenceId"');
    }
    const stopped = mockState.geofences.delete(geofenceId);
    return { stopped, geofenceId };
  }

  /**
   * Action 95: LIST_GEOFENCES
   */
  public static listGeofences(): { geofences: GeofenceRegionResult[] } {
    return { geofences: Array.from(mockState.geofences.values()) };
  }

  /**
   * Action 96: EVALUATE_GEOFENCE
   * Calculates Haversine distance from test coordinates to all active geofence circles
   */
  public static evaluateGeofence(payload: any = {}): GeofenceTransitionResult {
    const lat = typeof payload.latitude === 'number' ? payload.latitude : mockState.location.latitude;
    const lng = typeof payload.longitude === 'number' ? payload.longitude : mockState.location.longitude;

    const events: Array<{ geofenceId: string; transition: 'ENTER' | 'EXIT' }> = [];

    for (const [id, fence] of mockState.geofences.entries()) {
      const dist = this.haversineDistance(lat, lng, fence.latitude, fence.longitude);
      if (dist <= fence.radiusMeters) {
        if (fence.transitionType === 'ENTER' || fence.transitionType === 'BOTH') {
          events.push({ geofenceId: id, transition: 'ENTER' });
        }
      } else {
        if (fence.transitionType === 'EXIT' || fence.transitionType === 'BOTH') {
          events.push({ geofenceId: id, transition: 'EXIT' });
        }
      }
    }

    return { events };
  }

  private static haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
