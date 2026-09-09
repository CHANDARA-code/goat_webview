import { defineFeature } from '../types';

/**
 * T8 — Location & geofencing (Domain 7).
 *
 * The two-stage permission priming dialog is native (GoatPermissionPrimingDialog); this module
 * only routes. Geofencing actions are included because they share the same native manager and a
 * host linking location almost always wants them.
 */
export const locationFeature = defineFeature('location', {
  getLocation: 'GET_LOCATION',
  chooseLocation: 'CHOOSE_LOCATION',
  openLocation: 'OPEN_LOCATION',
  startGeofence: 'START_GEOFENCE',
  stopGeofence: 'STOP_GEOFENCE',
  listGeofences: 'LIST_GEOFENCES',
  evaluateGeofence: 'EVALUATE_GEOFENCE',
});
export default locationFeature;
