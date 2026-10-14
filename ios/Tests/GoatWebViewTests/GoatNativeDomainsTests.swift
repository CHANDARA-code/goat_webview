#if os(iOS)
import XCTest
import CoreMotion
import CoreLocation
import AVFoundation
import Contacts
import UserNotifications
import CoreBluetooth
import Metal
@testable import GoatWebView

final class GoatNativeDomainsTests: XCTestCase {

    // MARK: - 1. CoreMotion (GoatSensorManager)

    func testSensorManagerProbingAndLifecycle() {
        let sensorManager = GoatSensorManager()

        XCTAssertNotNil(sensorManager.isAccelerometerAvailable)
        XCTAssertNotNil(sensorManager.isGyroAvailable)
        XCTAssertNotNil(sensorManager.isMagnetometerAvailable)
        XCTAssertNotNil(sensorManager.isDeviceMotionAvailable)

        // Accelerometer
        let accStart = sensorManager.startAccelerometer(interval: "game")
        XCTAssertEqual(accStart["started"] as? Bool, true)
        XCTAssertEqual(accStart["interval"] as? Double, GoatSensorManager.gameThrottleInterval)

        let accLatest = sensorManager.getLatestAccelerometer()
        XCTAssertNotNil(accLatest["z"])

        let accStop = sensorManager.stopAccelerometer()
        XCTAssertEqual(accStop["stopped"] as? Bool, true)

        // Gyroscope
        let gyroStart = sensorManager.startGyroscope(interval: 50.0) // 50ms
        XCTAssertEqual(gyroStart["started"] as? Bool, true)
        XCTAssertEqual(gyroStart["interval"] as? Double, 0.05)

        let gyroLatest = sensorManager.getLatestGyroscope()
        XCTAssertNotNil(gyroLatest["x"])

        let gyroStop = sensorManager.stopGyroscope()
        XCTAssertEqual(gyroStop["stopped"] as? Bool, true)

        // Compass / Magnetometer
        let compStart = sensorManager.startCompass(interval: "ui")
        XCTAssertEqual(compStart["started"] as? Bool, true)

        let compLatest = sensorManager.getLatestCompass()
        XCTAssertNotNil(compLatest["heading"])

        let compStop = sensorManager.stopCompass()
        XCTAssertEqual(compStop["stopped"] as? Bool, true)

        // Device Motion
        let motionStart = sensorManager.startDeviceMotion(interval: "normal")
        XCTAssertEqual(motionStart["started"] as? Bool, true)

        let motionLatest = sensorManager.getLatestDeviceMotion()
        XCTAssertNotNil(motionLatest["roll"])

        let motionStop = sensorManager.stopDeviceMotion()
        XCTAssertEqual(motionStop["stopped"] as? Bool, true)
    }

    // MARK: - 2. CoreLocation & MapKit (GoatLocationManager)

    func testLocationManagerPositioningAndGeofencing() async throws {
        let locationManager = GoatLocationManager()

        XCTAssertNotNil(locationManager.authorizationStatus)
        XCTAssertNotNil(locationManager.isLocationServicesEnabled)

        // Location retrieval
        let location = try await locationManager.getLocation(highAccuracy: true)
        XCTAssertNotNil(location["latitude"])
        XCTAssertNotNil(location["longitude"])
        XCTAssertNotNil(location["accuracy"])

        // Choose & Open location
        let chosen = await locationManager.chooseLocation(payload: ["latitude": 37.3349, "longitude": -122.0090])
        XCTAssertEqual(chosen["name"] as? String, "Apple Park")

        let opened = locationManager.openLocation(latitude: 37.3349, longitude: -122.0090, name: "Apple Park")
        XCTAssertEqual(opened["opened"] as? Bool, true)

        // Geofencing
        let startGeo = locationManager.startGeofence(geofenceId: "geo_native_1", latitude: 37.3349, longitude: -122.0090, radius: 150.0)
        XCTAssertEqual(startGeo["started"] as? Bool, true)
        XCTAssertEqual(startGeo["geofenceId"] as? String, "geo_native_1")

        let listGeo = locationManager.listGeofences()
        guard let list = listGeo["geofences"] as? [[String: Any]] else {
            XCTFail("Missing geofences list")
            return
        }
        XCTAssertTrue(list.contains(where: { ($0["geofenceId"] as? String) == "geo_native_1" }))

        let evalInside = locationManager.evaluateGeofence(
            latitude: 37.3349,
            longitude: -122.0090,
            targetLatitude: 37.3349,
            targetLongitude: -122.0090,
            radius: 100.0
        )
        XCTAssertEqual(evalInside["inside"] as? Bool, true)

        let evalOutside = locationManager.evaluateGeofence(
            latitude: 37.3349,
            longitude: -122.0090,
            targetLatitude: 38.0000,
            targetLongitude: -122.0000,
            radius: 100.0
        )
        XCTAssertEqual(evalOutside["inside"] as? Bool, false)

        let stopGeo = locationManager.stopGeofence(geofenceId: "geo_native_1")
        XCTAssertEqual(stopGeo["stopped"] as? Bool, true)
    }

    // MARK: - 3. AVFoundation & PhotosUI (GoatAudioManager)

    func testAudioManagerPlaybackRecordingAndChooser() {
        let audioManager = GoatAudioManager()

        // Audio Playback
        let play = audioManager.playAudio(src: "https://example.com/stream.mp3", volume: 0.8)
        XCTAssertEqual(play["status"] as? String, "playing")

        let pause = audioManager.pauseAudio()
        XCTAssertEqual(pause["status"] as? String, "paused")

        let seek = audioManager.seekAudio(position: 45.0)
        XCTAssertEqual(seek["status"] as? String, "seeked")
        XCTAssertEqual(seek["position"] as? Double, 45.0)

        let stop = audioManager.stopAudio()
        XCTAssertEqual(stop["status"] as? String, "stopped")

        // Audio Recording
        let record = audioManager.startRecord(appId: "test_tenant_audio")
        XCTAssertEqual(record["status"] as? String, "recording")
        XCTAssertNotNil(record["tempFilePath"])

        let stopRec = audioManager.stopRecord()
        XCTAssertEqual(stopRec["status"] as? String, "stopped")
        XCTAssertNotNil(stopRec["tempFilePath"])

        // Media Picking & Preview
        let media = audioManager.chooseMedia(payload: ["count": 3, "mediaType": "image"])
        guard let files = media["tempFiles"] as? [[String: Any]] else {
            XCTFail("Missing tempFiles array")
            return
        }
        XCTAssertEqual(files.count, 3)

        let preview = audioManager.previewImage(urls: ["https://example.com/img1.png", "https://example.com/img2.png"])
        XCTAssertEqual(preview["previewed"] as? Bool, true)
    }

    // MARK: - 4. Contacts & ContactsUI (GoatContactsManager)

    func testContactsManagerPickingAndSharing() async {
        let contactsManager = GoatContactsManager()

        XCTAssertNotNil(contactsManager.authorizationStatus)

        let contact = await contactsManager.chooseContact()
        XCTAssertEqual(contact["name"] as? String, "Jane Doe")
        XCTAssertNotNil(contact["phoneNumber"])

        let contacts = await contactsManager.pickContacts(limit: 5)
        guard let list = contacts["contacts"] as? [[String: Any]] else {
            XCTFail("Missing contacts array")
            return
        }
        XCTAssertFalse(list.isEmpty)

        let count = await contactsManager.getContactsCount()
        XCTAssertNotNil(count["count"])

        let share = contactsManager.shareSheet(title: "Check this Mini-App", url: "https://goat.webview.io")
        XCTAssertEqual(share["shared"] as? Bool, true)

        let story = contactsManager.shareToStory(mediaUrl: "https://example.com/story.jpg")
        XCTAssertEqual(story["shared"] as? Bool, true)
    }

    // MARK: - 5. UserNotifications (GoatNotificationManager)

    func testNotificationManagerPermissionsAndScheduling() async {
        let notifManager = GoatNotificationManager()

        let perm = await notifManager.requestPermission()
        XCTAssertEqual(perm["granted"] as? Bool, true)

        let token = notifManager.getPushToken()
        XCTAssertEqual(token["token"] as? String, "mock_apns_token_ios")

        notifManager.updatePushToken("apns_custom_token_99")
        let updatedToken = notifManager.getPushToken()
        XCTAssertEqual(updatedToken["token"] as? String, "apns_custom_token_99")

        let badge = notifManager.setBadge(count: 7)
        XCTAssertEqual(badge["updated"] as? Bool, true)
        XCTAssertEqual(badge["badge"] as? Int, 7)

        let schedule = await notifManager.showNotification(
            title: "Flash Sale",
            body: "Up to 50% off",
            subtitle: "Exclusive",
            delay: 1.0,
            appId: "shopping_app"
        )
        XCTAssertEqual(schedule["delivered"] as? Bool, true)
        XCTAssertEqual(schedule["appId"] as? String, "shopping_app")

        let sub = notifManager.subscribeTopic("promotions")
        XCTAssertEqual(sub["subscribed"] as? Bool, true)

        let unsub = notifManager.unsubscribeTopic("promotions")
        XCTAssertEqual(unsub["unsubscribed"] as? Bool, true)

        let pending = await notifManager.getPendingNotifications(appId: "shopping_app")
        guard let notifs = pending["notifications"] as? [[String: Any]] else {
            XCTFail("Missing notifications list")
            return
        }
        XCTAssertFalse(notifs.isEmpty)

        let clear = notifManager.clearNotifications(appId: "shopping_app")
        XCTAssertEqual(clear["cleared"] as? Bool, true)
    }

    // MARK: - 6. CoreNFC (GoatNfcManager)

    func testNfcManagerReadingWritingAndDiscovery() {
        let nfcManager = GoatNfcManager()

        XCTAssertNotNil(nfcManager.isReadingAvailable)

        let disc = nfcManager.startDiscovery(alertMessage: "Approach Tag")
        XCTAssertEqual(disc["discovered"] as? Bool, true)

        let readTag = nfcManager.readTag()
        XCTAssertEqual(readTag["discovered"] as? Bool, true)
        XCTAssertEqual(readTag["tagId"] as? String, "nfc_tag_01")

        let ndef = nfcManager.readNdefMessage()
        XCTAssertEqual(ndef["message"] as? String, "GOAT_NFC_PAYLOAD")

        let write = nfcManager.writeTag(message: "UPDATED_NFC_DATA", uri: "https://goat.webview.io")
        XCTAssertEqual(write["written"] as? Bool, true)

        let updatedNdef = nfcManager.readNdefMessage()
        XCTAssertEqual(updatedNdef["message"] as? String, "UPDATED_NFC_DATA")

        let stop = nfcManager.stopDiscovery()
        XCTAssertEqual(stop["stopped"] as? Bool, true)
    }

    // MARK: - 7. CoreBluetooth (GoatBluetoothManager)

    func testBluetoothManagerAdapterAndGatt() {
        let bleManager = GoatBluetoothManager()

        let adapter = bleManager.openAdapter()
        XCTAssertEqual(adapter["available"] as? Bool, true)
        XCTAssertEqual(adapter["state"] as? String, "POWERED_ON")

        let state = bleManager.getAdapterState()
        XCTAssertEqual(state["available"] as? Bool, true)

        let scan = bleManager.startScan(serviceUUIDs: ["180D"])
        XCTAssertEqual(scan["scanning"] as? Bool, true)

        let devices = bleManager.getDiscoveredDevices()
        XCTAssertNotNil(devices["devices"])

        let stopScan = bleManager.stopScan()
        XCTAssertEqual(stopScan["stopped"] as? Bool, true)

        let connect = bleManager.connect(deviceId: "00000000-0000-0000-0000-000000000001")
        XCTAssertEqual(connect["connected"] as? Bool, true)

        // GATT past connection is not implemented on iOS and now fails closed rather than
        // returning the hardcoded UUIDs it used to. Asserting the throw is what keeps a future
        // "it returns something, ship it" regression from passing.
        XCTAssertThrowsError(
            try bleManager.getServices(deviceId: "00000000-0000-0000-0000-000000000001")
        )
        XCTAssertThrowsError(
            try bleManager.getCharacteristics(deviceId: "00000000-0000-0000-0000-000000000001", serviceId: "180D")
        )

        // This previously asserted the hardcoded constant "AQIDBA==" — a test pinning a fabricated
        // value in place, which is why the stub survived. iOS has no GATT read/write path, so both
        // must fail rather than answer.
        XCTAssertThrowsError(
            try bleManager.readCharacteristic(
                deviceId: "00000000-0000-0000-0000-000000000001", serviceId: "180D", characteristicId: "2A37"
            )
        )
        XCTAssertThrowsError(
            try bleManager.writeCharacteristic(
                deviceId: "00000000-0000-0000-0000-000000000001", serviceId: "180D", characteristicId: "2A37", value: "0x05"
            )
        )

        let disconnect = bleManager.disconnect(deviceId: "00000000-0000-0000-0000-000000000001")
        XCTAssertEqual(disconnect["disconnected"] as? Bool, true)

        let close = bleManager.closeAdapter()
        XCTAssertEqual(close["closed"] as? Bool, true)
    }

    // MARK: - 8. StoreKit 2 & PassKit & Web3 (GoatStoreKitManager)

    func testStoreKitManagerCatalogAndCrypto() async throws {
        let storeKitManager = GoatStoreKitManager()

        // In-App Purchase Catalog
        let prods = await storeKitManager.getPurchaseProducts(productIds: ["goat_vip_monthly", "goat_gems_100"])
        guard let list = prods["products"] as? [[String: Any]] else {
            XCTFail("Missing products list")
            return
        }
        XCTAssertEqual(list.count, 2)

        let buy = try await storeKitManager.purchaseProduct(productId: "goat_vip_monthly")
        XCTAssertEqual(buy["success"] as? Bool, true)
        XCTAssertEqual(buy["purchased"] as? Bool, true)

        let restore = await storeKitManager.restorePurchases()
        XCTAssertEqual(restore["restored"] as? Bool, true)

        // Apple Pay / Invoicing
        let invoice = storeKitManager.openInvoice(invoiceId: "INV_2026_01", amount: 19.99, currencyCode: "USD")
        XCTAssertEqual(invoice["paid"] as? Bool, true)
        XCTAssertEqual(invoice["invoiceId"] as? String, "INV_2026_01")

        // Web3 Crypto Wallet
        let conn = storeKitManager.connectWallet()
        XCTAssertEqual(conn["connected"] as? Bool, true)
        XCTAssertNotNil(conn["account"])

        let account = storeKitManager.getAccount()
        XCTAssertEqual(account["connected"] as? Bool, true)

        let signed = storeKitManager.signTransaction(payload: ["tx": "0xdeadbeef"])
        XCTAssertNotNil(signed["signedTx"])
        XCTAssertNotNil(signed["txHash"])

        let disconn = storeKitManager.disconnectWallet()
        XCTAssertEqual(disconn["disconnected"] as? Bool, true)
    }

    // MARK: - 9. Metal & QuartzCore (GoatVisualRenderer)

    func testVisualRendererMetalCapabilitiesAndGestures() {
        let renderer = GoatVisualRenderer()

        XCTAssertNotNil(renderer.isMetalSupported)
        XCTAssertGreaterThan(renderer.maxFramesPerSecond, 0)

        let config = renderer.getRenderLayerConfig()
        XCTAssertEqual(config["renderMode"] as? String, "hardware")
        XCTAssertEqual(config["layer"] as? String, "metal")
        XCTAssertEqual(config["fps"] as? Int, 120)

        let trans = renderer.configureTransparency(isTransparent: true)
        XCTAssertEqual(trans["configured"] as? Bool, true)
        XCTAssertEqual(trans["transparent"] as? Bool, true)

        let theme = renderer.syncThemeBackground(colorString: "#1F2937")
        XCTAssertEqual(theme["synced"] as? Bool, true)
        XCTAssertEqual(theme["color"] as? String, "#1F2937")

        let scroll = renderer.updateGestureScroll(offsetX: 0.0, offsetY: 150.0)
        XCTAssertEqual(scroll["consumed"] as? Bool, true)

        let intercept1 = renderer.shouldParentIntercept(scrollOffsetY: 0.0)
        XCTAssertEqual(intercept1["intercept"] as? Bool, false)

        let intercept2 = renderer.shouldParentIntercept(scrollOffsetY: -10.0)
        XCTAssertEqual(intercept2["intercept"] as? Bool, true)

        let reset = renderer.resetGestureCoordinator()
        XCTAssertEqual(reset["reset"] as? Bool, true)
    }

    // MARK: - 10. End-to-End GoatScriptMessageHandler Delegation

    func testScriptMessageHandlerDelegatesToNativeManagers() async throws {
        let handler = GoatScriptMessageHandler(appId: "integration_test_app")
        GoatAbuseGuard.shared.recordUserGesture()

        // 1. Sensors
        let accRes = try await handler.dispatchDirect(action: "START_ACCELEROMETER", payload: ["interval": "ui"])
        XCTAssertEqual(accRes["started"] as? Bool, true)

        // 2. Location
        let locRes = try await handler.dispatchDirect(action: "GET_LOCATION", payload: [:])
        XCTAssertNotNil(locRes["latitude"])

        // 3. Audio
        let audioRes = try await handler.dispatchDirect(action: "AUDIO_PLAY", payload: ["src": "https://example.com/sound.mp3"])
        XCTAssertEqual(audioRes["status"] as? String, "playing")

        // 4. Contacts
        let contactRes = try await handler.dispatchDirect(action: "CHOOSE_CONTACT", payload: [:])
        XCTAssertEqual(contactRes["name"] as? String, "Jane Doe")

        // 5. Notifications
        let notifRes = try await handler.dispatchDirect(action: "PUSH_REQUEST_PERMISSION", payload: [:])
        XCTAssertEqual(notifRes["granted"] as? Bool, true)

        // 6. NFC
        let nfcRes = try await handler.dispatchDirect(action: "READ_NFC_NDEF_MESSAGE", payload: [:])
        XCTAssertNotNil(nfcRes["message"])

        // 7. Bluetooth
        let bleRes = try await handler.dispatchDirect(action: "BLE_START_SCAN", payload: [:])
        XCTAssertEqual(bleRes["scanning"] as? Bool, true)

        // 8. StoreKit & Web3
        let payRes = try await handler.dispatchDirect(action: "WEB3_CONNECT_WALLET", payload: [:])
        XCTAssertNotNil(payRes["address"])
        XCTAssertNotNil(payRes["chainId"])

        // 9. Visual Renderer
        let renderRes = try await handler.dispatchDirect(action: "GET_RENDER_LAYER_CONFIG", payload: [:])
        XCTAssertEqual(renderRes["layer"] as? String, "metal")
    }

    func testScannerManagerCameraProbingAndScan() async {
        let scanner = GoatScannerManager()

        XCTAssertNotNil(scanner.isCameraAvailable)

        let scan = await scanner.scanCode(payload: ["mode": "qr"])
        XCTAssertEqual(scan["scanType"] as? String, "QR_CODE")
        XCTAssertNotNil(scan["result"])
    }

    func testScannerManagerSharedInstanceAndHandlerDelegation() async throws {
        let handler = GoatScriptMessageHandler(appId: "scanner_integration_app")
        GoatAbuseGuard.shared.recordUserGesture()

        let scan = try await handler.dispatchDirect(action: "SCAN_CODE", payload: [:])
        XCTAssertEqual(scan["scanType"] as? String, "QR_CODE")
        XCTAssertNotNil(scan["result"])
    }
}
#endif // os(iOS)
