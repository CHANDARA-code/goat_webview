import Foundation
import CoreMotion

/**
 * Enterprise iOS Hardware Sensor Manager for Goat WebView (Task 10122 & Sprint 2).
 *
 * Utilizes Apple `CoreMotion` framework (`CMMotionManager`) to provide high-performance,
 * throttled streaming and point-in-time querying for:
 * 1. 3-Axis Accelerometer (`CMAccelerometerData`)
 * 2. 3-Axis Gyroscope (`CMGyroData`)
 * 3. 3-Axis Magnetometer / Compass (`CMMagnetometerData`)
 * 4. Device Motion / Attitude / Euler Angles (`CMDeviceMotion`)
 *
 * Integrates with `GoatEventCoalescer` to prevent JS bridge saturation and CPU wake-locks.
 */
public class GoatSensorManager {
    public static let shared = GoatSensorManager()

    public static let defaultThrottleInterval: TimeInterval = 0.05 // 20 Hz
    public static let uiThrottleInterval: TimeInterval = 0.033     // 30 Hz
    public static let gameThrottleInterval: TimeInterval = 0.016   // 60 Hz

    private let motionManager: CMMotionManager
    private let motionQueue: OperationQueue
    private let lock = NSLock()

    private var latestAccelerometer: [String: Any] = ["x": 0.0, "y": 0.0, "z": 9.8]
    private var latestGyroscope: [String: Any] = ["x": 0.0, "y": 0.0, "z": 0.0]
    private var latestCompass: [String: Any] = ["heading": 0.0, "accuracy": 0.0]
    private var latestDeviceMotion: [String: Any] = [
        "roll": 0.0,
        "pitch": 0.0,
        "yaw": 0.0,
        "gravity": ["x": 0.0, "y": 0.0, "z": -1.0],
        "userAcceleration": ["x": 0.0, "y": 0.0, "z": 0.0]
    ]

    private var isAccelerometerActive = false
    private var isGyroscopeActive = false
    private var isCompassActive = false
    private var isDeviceMotionActive = false

    public init(motionManager: CMMotionManager = CMMotionManager()) {
        self.motionManager = motionManager
        let queue = OperationQueue()
        queue.name = "com.goat.webview.coremotion"
        queue.maxConcurrentOperationCount = 1
        queue.qualityOfService = .userInteractive
        self.motionQueue = queue
    }

    // MARK: - Hardware Probing

    public var isAccelerometerAvailable: Bool {
        motionManager.isAccelerometerAvailable
    }

    public var isGyroAvailable: Bool {
        motionManager.isGyroAvailable
    }

    public var isMagnetometerAvailable: Bool {
        motionManager.isMagnetometerAvailable
    }

    public var isDeviceMotionAvailable: Bool {
        motionManager.isDeviceMotionAvailable
    }

    // MARK: - Interval Parsing

    private func parseInterval(_ interval: Any?) -> TimeInterval {
        if let modeStr = interval as? String {
            switch modeStr.lowercased() {
            case "game": return Self.gameThrottleInterval
            case "ui":   return Self.uiThrottleInterval
            default:     return Self.defaultThrottleInterval
            }
        }
        if let num = interval as? NSNumber {
            let val = num.doubleValue
            if val > 1.0 {
                return val / 1000.0 // Convert ms to seconds
            }
            return max(0.01, val)
        }
        return Self.defaultThrottleInterval
    }

    // MARK: - Accelerometer

    public func startAccelerometer(interval: Any? = nil) -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }

        let updateInterval = parseInterval(interval)
        motionManager.accelerometerUpdateInterval = updateInterval
        isAccelerometerActive = true

        if motionManager.isAccelerometerAvailable {
            motionManager.startAccelerometerUpdates(to: motionQueue) { [weak self] data, error in
                guard let self = self, let data = data, error == nil else { return }
                let payload: [String: Any] = [
                    "x": data.acceleration.x,
                    "y": data.acceleration.y,
                    "z": data.acceleration.z,
                    "timestamp": data.timestamp
                ]
                self.lock.lock()
                self.latestAccelerometer = payload
                self.lock.unlock()

                GoatEventCoalescer.shared.emit(
                    eventKey: "ON_ACCELEROMETER_CHANGE",
                    payload: payload,
                    minInterval: updateInterval
                ) { _, _ in }
            }
        }

        return ["started": true, "interval": updateInterval]
    }

    public func stopAccelerometer() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }

        if motionManager.isAccelerometerActive {
            motionManager.stopAccelerometerUpdates()
        }
        isAccelerometerActive = false
        GoatEventCoalescer.shared.cancel(eventKey: "ON_ACCELEROMETER_CHANGE")
        return ["stopped": true]
    }

    public func getLatestAccelerometer() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        return latestAccelerometer
    }

    // MARK: - Gyroscope

    public func startGyroscope(interval: Any? = nil) -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }

        let updateInterval = parseInterval(interval)
        motionManager.gyroUpdateInterval = updateInterval
        isGyroscopeActive = true

        if motionManager.isGyroAvailable {
            motionManager.startGyroUpdates(to: motionQueue) { [weak self] data, error in
                guard let self = self, let data = data, error == nil else { return }
                let payload: [String: Any] = [
                    "x": data.rotationRate.x,
                    "y": data.rotationRate.y,
                    "z": data.rotationRate.z,
                    "timestamp": data.timestamp
                ]
                self.lock.lock()
                self.latestGyroscope = payload
                self.lock.unlock()

                GoatEventCoalescer.shared.emit(
                    eventKey: "ON_GYROSCOPE_CHANGE",
                    payload: payload,
                    minInterval: updateInterval
                ) { _, _ in }
            }
        }

        return ["started": true, "interval": updateInterval]
    }

    public func stopGyroscope() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }

        if motionManager.isGyroActive {
            motionManager.stopGyroUpdates()
        }
        isGyroscopeActive = false
        GoatEventCoalescer.shared.cancel(eventKey: "ON_GYROSCOPE_CHANGE")
        return ["stopped": true]
    }

    public func getLatestGyroscope() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        return latestGyroscope
    }

    // MARK: - Magnetometer / Compass

    public func startCompass(interval: Any? = nil) -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }

        let updateInterval = parseInterval(interval)
        motionManager.magnetometerUpdateInterval = updateInterval
        isCompassActive = true

        if motionManager.isMagnetometerAvailable {
            motionManager.startMagnetometerUpdates(to: motionQueue) { [weak self] data, error in
                guard let self = self, let data = data, error == nil else { return }
                let payload: [String: Any] = [
                    "x": data.magneticField.x,
                    "y": data.magneticField.y,
                    "z": data.magneticField.z,
                    "timestamp": data.timestamp
                ]
                self.lock.lock()
                self.latestCompass = payload
                self.lock.unlock()

                GoatEventCoalescer.shared.emit(
                    eventKey: "ON_COMPASS_CHANGE",
                    payload: payload,
                    minInterval: updateInterval
                ) { _, _ in }
            }
        }

        return ["started": true, "interval": updateInterval]
    }

    public func stopCompass() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }

        if motionManager.isMagnetometerActive {
            motionManager.stopMagnetometerUpdates()
        }
        isCompassActive = false
        GoatEventCoalescer.shared.cancel(eventKey: "ON_COMPASS_CHANGE")
        return ["stopped": true]
    }

    public func getLatestCompass() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        return latestCompass
    }

    // MARK: - Device Motion

    public func startDeviceMotion(interval: Any? = nil) -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }

        let updateInterval = parseInterval(interval)
        motionManager.deviceMotionUpdateInterval = updateInterval
        isDeviceMotionActive = true

        if motionManager.isDeviceMotionAvailable {
            motionManager.startDeviceMotionUpdates(to: motionQueue) { [weak self] data, error in
                guard let self = self, let data = data, error == nil else { return }
                let payload: [String: Any] = [
                    "roll": data.attitude.roll,
                    "pitch": data.attitude.pitch,
                    "yaw": data.attitude.yaw,
                    "gravity": [
                        "x": data.gravity.x,
                        "y": data.gravity.y,
                        "z": data.gravity.z
                    ],
                    "userAcceleration": [
                        "x": data.userAcceleration.x,
                        "y": data.userAcceleration.y,
                        "z": data.userAcceleration.z
                    ],
                    "timestamp": data.timestamp
                ]
                self.lock.lock()
                self.latestDeviceMotion = payload
                self.lock.unlock()

                GoatEventCoalescer.shared.emit(
                    eventKey: "ON_DEVICE_MOTION_CHANGE",
                    payload: payload,
                    minInterval: updateInterval
                ) { _, _ in }
            }
        }

        return ["started": true, "interval": updateInterval]
    }

    public func stopDeviceMotion() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }

        if motionManager.isDeviceMotionActive {
            motionManager.stopDeviceMotionUpdates()
        }
        isDeviceMotionActive = false
        GoatEventCoalescer.shared.cancel(eventKey: "ON_DEVICE_MOTION_CHANGE")
        return ["stopped": true]
    }

    public func getLatestDeviceMotion() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        return latestDeviceMotion
    }

    // MARK: - Lifecycle Management

    public func pauseAll() {
        lock.lock()
        defer { lock.unlock() }
        if motionManager.isAccelerometerActive { motionManager.stopAccelerometerUpdates() }
        if motionManager.isGyroActive { motionManager.stopGyroUpdates() }
        if motionManager.isMagnetometerActive { motionManager.stopMagnetometerUpdates() }
        if motionManager.isDeviceMotionActive { motionManager.stopDeviceMotionUpdates() }
    }

    public func resumeAll() {
        lock.lock()
        defer { lock.unlock() }
        if isAccelerometerActive { _ = startAccelerometer() }
        if isGyroscopeActive { _ = startGyroscope() }
        if isCompassActive { _ = startCompass() }
        if isDeviceMotionActive { _ = startDeviceMotion() }
    }

    public func stopAll() {
        lock.lock()
        defer { lock.unlock() }
        pauseAll()
        isAccelerometerActive = false
        isGyroscopeActive = false
        isCompassActive = false
        isDeviceMotionActive = false
        GoatEventCoalescer.shared.cancel(eventKey: "ON_ACCELEROMETER_CHANGE")
        GoatEventCoalescer.shared.cancel(eventKey: "ON_GYROSCOPE_CHANGE")
        GoatEventCoalescer.shared.cancel(eventKey: "ON_COMPASS_CHANGE")
        GoatEventCoalescer.shared.cancel(eventKey: "ON_DEVICE_MOTION_CHANGE")
    }
}
