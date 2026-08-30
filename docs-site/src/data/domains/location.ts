import { ApiAction } from '../api-matrix';

export const locationActions: ApiAction[] = [
  {
    id: 'get-location',
    action: 'GET_LOCATION',
    aliases: ['getLocation'],
    domain: 'Location & Geofencing',
    domainSlug: 'location-geofencing',
    description: 'Retrieves current geographical coordinates (latitude, longitude, speed, altitude, accuracy) with WGS84 and GCJ02 support under active user permission and gesture gate.',
    purpose: 'Enables ride-hailing pickup, food delivery address detection, and nearby store locators.',
    permissions: {
      manifest: ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION', 'NSLocationWhenInUseUsageDescription'],
      scope: 'scope.userLocation',
      requiresGesture: true,
    },
    params: [
      { name: 'type', type: '"wgs84" | "gcj02"', required: false, description: 'Coordinate datum standard.', defaultValue: '"wgs84"' },
      { name: 'altitude', type: 'boolean', required: false, description: 'Include altitude elevation.', defaultValue: 'false' },
      { name: 'highAccuracy', type: 'boolean', required: false, description: 'Force GPS high accuracy mode.', defaultValue: 'true' },
      { name: 'highAccuracyExpireTime', type: 'number', required: false, description: 'High accuracy timeout in ms.', defaultValue: '3000' },
    ],
    returns: {
      type: 'LocationData',
      schema: { latitude: 'number', longitude: 'number', speed: 'number', accuracy: 'number', altitude: 'number', verticalAccuracy: 'number (optional)', horizontalAccuracy: 'number (optional)' },
      description: 'Geographic coordinate object.',
    },
    errors: [
      { code: 'PERMISSION_DENIED', meaning: 'User denied location permission request or system location services disabled.', troubleshooting: 'Prompt user to grant location permission using REQUEST_PERMISSION.' },
      { code: 'GESTURE_REQUIRED', meaning: 'GET_LOCATION invoked in background without recent user gesture.', troubleshooting: 'Call GET_LOCATION directly within user click/tap handler.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const loc = await goatBridge.callNative('GET_LOCATION', {
  type: 'wgs84',
  highAccuracy: true
});
console.log(\`Lat: \${loc.latitude}, Lon: \${loc.longitude}, Accuracy: \${loc.accuracy}m\`);`,
      kotlin: `val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null).addOnSuccessListener { ... }`,
      swift: `locationManager.requestLocation()`,
      dart: `final loc = await goatController.callNativeAction('GET_LOCATION', {
  'type': 'wgs84',
  'highAccuracy': true,
});`,
    },
    executable: true,
    defaultPayload: { type: 'wgs84', highAccuracy: true },
  },
  {
    id: 'choose-location',
    action: 'CHOOSE_LOCATION',
    aliases: ['chooseLocation'],
    domain: 'Location & Geofencing',
    domainSlug: 'location-geofencing',
    description: 'Presents a native full-screen interactive map picker for choosing a physical point of interest or custom address.',
    purpose: 'Allows users to visually select delivery addresses or meeting spots on a map.',
    permissions: {
      manifest: ['android.permission.ACCESS_FINE_LOCATION', 'NSLocationWhenInUseUsageDescription'],
      scope: 'scope.userLocation',
      requiresGesture: false,
    },
    params: [],
    returns: {
      type: 'ChooseLocationResult',
      schema: { name: 'string', address: 'string', latitude: 'number', longitude: 'number' },
      description: 'Selected location details.',
    },
    errors: [
      { code: 'PERMISSION_DENIED', meaning: 'Location permission was denied.', troubleshooting: 'Request scope.userLocation.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const poi = await goatBridge.callNative('CHOOSE_LOCATION', {});
console.log('Selected POI:', poi.name, poi.address);`,
      kotlin: `// Launch MapPickerActivity`,
      swift: `// Present MKLocalSearch or MapPickerViewController`,
      dart: `final res = await goatController.callNativeAction('CHOOSE_LOCATION', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'open-location',
    action: 'OPEN_LOCATION',
    aliases: ['openLocation'],
    domain: 'Location & Geofencing',
    domainSlug: 'location-geofencing',
    description: 'Opens native system map application (Google Maps / Apple Maps) centered at designated coordinates.',
    purpose: 'Directs user to navigate to merchant location in external turn-by-turn navigation apps.',
    permissions: { manifest: [], scope: 'none', requiresGesture: false },
    params: [
      { name: 'latitude', type: 'number', required: true, description: 'Destination latitude.' },
      { name: 'longitude', type: 'number', required: true, description: 'Destination longitude.' },
      { name: 'scale', type: 'number', required: false, description: 'Map zoom scale (5 to 18).', defaultValue: '14' },
      { name: 'name', type: 'string', required: false, description: 'Location POI label.' },
      { name: 'address', type: 'string', required: false, description: 'Detailed street address.' },
    ],
    returns: {
      type: 'OpenLocationResult',
      schema: { opened: 'boolean', latitude: 'number', longitude: 'number' },
      description: 'Status of map intent launch.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'Invalid latitude or longitude.', troubleshooting: 'Provide valid coordinate numbers.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('OPEN_LOCATION', {
  latitude: 37.7749,
  longitude: -122.4194,
  name: 'San Francisco HQ',
  address: '1 Market St, San Francisco, CA'
});`,
      kotlin: `val gmmIntentUri = Uri.parse("geo:\$latitude,\$longitude?q=" + Uri.encode(name))
context.startActivity(Intent(Intent.ACTION_VIEW, gmmIntentUri))`,
      swift: `let mapItem = MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude)))
mapItem.name = name
mapItem.openInMaps()`,
      dart: `await goatController.callNativeAction('OPEN_LOCATION', {
  'latitude': 37.7749,
  'longitude': -122.4194,
  'name': 'San Francisco HQ',
});`,
    },
    executable: true,
    defaultPayload: { latitude: 37.7749, longitude: -122.4194, name: 'Market Street HQ' },
  },
  {
    id: 'start-geofence',
    action: 'START_GEOFENCE',
    aliases: ['startGeofence', 'geofence'],
    domain: 'Location & Geofencing',
    domainSlug: 'location-geofencing',
    description: 'Registers a circular geofence boundary zone for background transition monitoring (ENTER / EXIT).',
    purpose: 'Triggers proximity discounts, store arrival notifications, or automated check-ins.',
    permissions: {
      manifest: ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_BACKGROUND_LOCATION', 'NSLocationAlwaysAndWhenInUseUsageDescription'],
      scope: 'scope.userLocation',
      requiresGesture: false,
    },
    params: [
      { name: 'geofenceId', type: 'string', required: true, description: 'Unique zone identifier.' },
      { name: 'latitude', type: 'number', required: true, description: 'Zone center latitude.' },
      { name: 'longitude', type: 'number', required: true, description: 'Zone center longitude.' },
      { name: 'radiusMeters', type: 'number', required: false, description: 'Circular boundary radius in meters.', defaultValue: '200' },
      { name: 'transitionType', type: '"ENTER" | "EXIT" | "BOTH"', required: false, description: 'Trigger transition events.', defaultValue: '"BOTH"' },
    ],
    returns: {
      type: 'GeofenceStartResult',
      schema: { started: 'boolean', geofenceId: 'string', radiusMeters: 'number' },
      description: 'Confirmation that geofence is active.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'geofenceId or coordinates missing.', troubleshooting: 'Provide valid geofenceId, latitude, and longitude.' },
      { code: 'PERMISSION_DENIED', meaning: 'Background location permission missing.', troubleshooting: 'Request background location scope.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('START_GEOFENCE', {
  geofenceId: 'store_downtown',
  latitude: 37.7749,
  longitude: -122.4194,
  radiusMeters: 250,
  transitionType: 'BOTH'
});`,
      kotlin: `val geofence = Geofence.Builder()
    .setRequestId(geofenceId)
    .setCircularRegion(latitude, longitude, radiusMeters)
    .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT)
    .build()
geofencingClient.addGeofences(request, pendingIntent)`,
      swift: `let region = CLCircularRegion(center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude), radius: radiusMeters, identifier: geofenceId)
locationManager.startMonitoring(for: region)`,
      dart: `await goatController.callNativeAction('START_GEOFENCE', {
  'geofenceId': 'store_downtown',
  'latitude': 37.7749,
  'longitude': -122.4194,
});`,
    },
    executable: true,
    defaultPayload: { geofenceId: 'zone_downtown', latitude: 37.7749, longitude: -122.4194, radiusMeters: 200 },
  },
  {
    id: 'stop-geofence',
    action: 'STOP_GEOFENCE',
    aliases: ['stopGeofence'],
    domain: 'Location & Geofencing',
    domainSlug: 'location-geofencing',
    description: 'Removes an active circular geofence zone.',
    purpose: 'Cleans up location monitoring when leaving an area.',
    permissions: { manifest: [], scope: 'scope.userLocation', requiresGesture: false },
    params: [
      { name: 'geofenceId', type: 'string', required: true, description: 'Geofence identifier to remove.' },
    ],
    returns: {
      type: 'GeofenceStopResult',
      schema: { stopped: 'boolean', geofenceId: 'string' },
      description: 'Status of geofence removal.',
    },
    errors: [
      { code: 'INVALID_ARGUMENT', meaning: 'geofenceId missing.', troubleshooting: 'Specify geofenceId.' },
    ],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `await goatBridge.callNative('STOP_GEOFENCE', { geofenceId: 'store_downtown' });`,
      kotlin: `geofencingClient.removeGeofences(listOf(geofenceId))`,
      swift: `// locationManager.stopMonitoring(for: region)`,
      dart: `await goatController.callNativeAction('STOP_GEOFENCE', {'geofenceId': 'store_downtown'});`,
    },
    executable: true,
    defaultPayload: { geofenceId: 'zone_downtown' },
  },
  {
    id: 'list-geofences',
    action: 'LIST_GEOFENCES',
    aliases: ['listGeofences'],
    domain: 'Location & Geofencing',
    domainSlug: 'location-geofencing',
    description: 'Queries all currently active monitored geofence regions.',
    purpose: 'Inspects active perimeter boundaries.',
    permissions: { manifest: [], scope: 'scope.userLocation', requiresGesture: false },
    params: [],
    returns: {
      type: 'GeofenceListResult',
      schema: { geofences: 'GeofenceRegionResult[]' },
      description: 'Array of active geofence zones.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const { geofences } = await goatBridge.callNative('LIST_GEOFENCES', {});`,
      kotlin: `// Query active geofence list`,
      swift: `let regions = locationManager.monitoredRegions`,
      dart: `final res = await goatController.callNativeAction('LIST_GEOFENCES', {});`,
    },
    executable: true,
    defaultPayload: {},
  },
  {
    id: 'evaluate-geofence',
    action: 'EVALUATE_GEOFENCE',
    aliases: ['evaluateGeofence', 'onLocationChange'],
    domain: 'Location & Geofencing',
    domainSlug: 'location-geofencing',
    description: 'Manually tests current coordinate against registered geofence zones and returns transition events using Haversine calculation.',
    purpose: 'Simulates or performs client-side geofence boundary testing.',
    permissions: { manifest: [], scope: 'scope.userLocation', requiresGesture: false },
    params: [
      { name: 'latitude', type: 'number', required: true, description: 'Test latitude.' },
      { name: 'longitude', type: 'number', required: true, description: 'Test longitude.' },
    ],
    returns: {
      type: 'GeofenceTransitionResult',
      schema: { events: 'Array<{ geofenceId: string, transition: "ENTER" | "EXIT" }>' },
      description: 'List of boundary crossing events.',
    },
    errors: [],
    platforms: { android: true, ios: true, reactNative: true, flutter: true, web: true },
    snippets: {
      typescript: `const transitions = await goatBridge.callNative('EVALUATE_GEOFENCE', {
  latitude: 37.7749,
  longitude: -122.4194
});`,
      kotlin: `// Evaluate distanceTo across geofence centers`,
      swift: `// Evaluate coordinate against monitored regions`,
      dart: `final res = await goatController.callNativeAction('EVALUATE_GEOFENCE', {
  'latitude': 37.7749,
  'longitude': -122.4194,
});`,
    },
    executable: true,
    defaultPayload: { latitude: 37.7749, longitude: -122.4194 },
  },
];
