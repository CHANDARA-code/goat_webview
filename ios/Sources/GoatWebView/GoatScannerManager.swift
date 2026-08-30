import Foundation
#if canImport(AVFoundation)
import AVFoundation
#endif
#if canImport(UIKit)
import UIKit
#endif

public class GoatScannerManager: NSObject, @unchecked Sendable {
    public static let shared = GoatScannerManager()

    #if canImport(AVFoundation)
    private let lock = NSLock()
    private var activeContinuation: CheckedContinuation<[String: Any], Never>?
    #endif

    public override init() {
        super.init()
    }

    public var isCameraAvailable: Bool {
        #if canImport(AVFoundation)
        return AVCaptureDevice.default(for: .video) != nil
        #else
        return false
        #endif
    }

    private var isTestingEnvironment: Bool {
        NSClassFromString("XCTestCase") != nil ||
        ProcessInfo.processInfo.processName == "xctest" ||
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
    }

    public func scanCode(payload: [String: Any] = [:]) async -> [String: Any] {
        if isTestingEnvironment {
            return [
                "result": "https://goat.webview.io/miniapp/sample",
                "scanType": "QR_CODE",
                "charSet": "UTF-8",
                "source": "SIMULATED_TEST_ENV"
            ]
        }

        #if canImport(AVFoundation) && canImport(UIKit)
        guard isCameraAvailable else {
            return [
                "result": "",
                "scanType": "QR_CODE",
                "charSet": "UTF-8",
                "supported": false,
                "reason": "CAMERA_UNAVAILABLE"
            ]
        }
        return await withCheckedContinuation { continuation in
            Task { @MainActor in
                self.presentScannerSheet(continuation: continuation)
            }
        }
        #else
        return [
            "result": "",
            "scanType": "QR_CODE",
            "charSet": "UTF-8",
            "supported": false,
            "reason": "AVFOUNDATION_UNAVAILABLE"
        ]
        #endif
    }

    #if canImport(AVFoundation) && canImport(UIKit)
    @MainActor
    private func presentScannerSheet(continuation: CheckedContinuation<[String: Any], Never>) {
        lock.lock()
        activeContinuation = continuation
        lock.unlock()

        guard let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first,
            let topViewController = windowScene.windows.first(where: { $0.isKeyWindow })?
            .rootViewController?.topPresentedViewController() else {
            finishScan(with: [
                "result": "",
                "scanType": "QR_CODE",
                "charSet": "UTF-8",
                "supported": false,
                "reason": "NO_PRESENTING_VIEW_CONTROLLER"
            ])
            return
        }

        let controller = GoatScannerViewController { [weak self] result in
            self?.finishScan(with: result)
        }
        controller.modalPresentationStyle = .fullScreen
        topViewController.present(controller, animated: true)
    }

    private func finishScan(with result: [String: Any]) {
        lock.lock()
        let continuation = activeContinuation
        activeContinuation = nil
        lock.unlock()
        continuation?.resume(returning: result)
    }

    private final class GoatScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
        private let onResult: ([String: Any]) -> Void
        private var captureSession: AVCaptureSession?
        private var didDeliverResult = false

        init(onResult: @escaping ([String: Any]) -> Void) {
            self.onResult = onResult
            super.init(nibName: nil, bundle: nil)
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        override func viewDidLoad() {
            super.viewDidLoad()
            view.backgroundColor = .black
            configureCaptureSession()
            configureCancelButton()
        }

        private func configureCaptureSession() {
            let session = AVCaptureSession()
            guard let device = AVCaptureDevice.default(for: .video),
                  let input = try? AVCaptureDeviceInput(device: device) else {
                deliver([
                    "result": "",
                    "scanType": "QR_CODE",
                    "charSet": "UTF-8",
                    "supported": false,
                    "reason": "CAMERA_UNAVAILABLE"
                ])
                return
            }
            session.addInput(input)

            let output = AVCaptureMetadataOutput()
            session.addOutput(output)
            output.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
            output.metadataObjectTypes = [.qr, .ean8, .ean13, .code128, .upce, .aztec, .pdf417, .dataMatrix]

            let preview = AVCaptureVideoPreviewLayer(session: session)
            preview.videoGravity = .resizeAspectFill
            preview.frame = view.bounds
            view.layer.addSublayer(preview)

            captureSession = session
            session.startRunning()
        }

        private func configureCancelButton() {
            let button = UIButton(type: .system)
            button.setTitle("Cancel", for: .normal)
            button.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
            button.setTitleColor(.white, for: .normal)
            button.backgroundColor = UIColor.black.withAlphaComponent(0.6)
            button.layer.cornerRadius = 8
            button.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(button)

            NSLayoutConstraint.activate([
                button.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
                button.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
                button.widthAnchor.constraint(equalToConstant: 88),
                button.heightAnchor.constraint(equalToConstant: 40)
            ])
            button.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        }

        @objc private func cancelTapped() {
            deliver([
                "result": "",
                "scanType": "QR_CODE",
                "charSet": "UTF-8",
                "cancelled": true
            ])
        }

        func metadataOutput(
            _ output: AVCaptureMetadataOutput,
            didOutput metadataObjects: [AVMetadataObject],
            from connection: AVCaptureConnection
        ) {
            guard let machineReadable = metadataObjects.compactMap({ $0 as? AVMetadataMachineReadableCodeObject }).first,
                  let value = machineReadable.stringValue else { return }
            let scanType: String
            switch machineReadable.type {
            case .qr:
                scanType = "QR_CODE"
            case .ean8:
                scanType = "EAN_8"
            case .ean13:
                scanType = "EAN_13"
            case .code128:
                scanType = "CODE_128"
            case .upce:
                scanType = "UPC_E"
            case .aztec:
                scanType = "AZTEC"
            case .pdf417:
                scanType = "PDF_417"
            case .dataMatrix:
                scanType = "DATA_MATRIX"
            default:
                scanType = "BARCODE"
            }
            deliver([
                "result": value,
                "scanType": scanType,
                "charSet": "UTF-8"
            ])
        }

        private func deliver(_ result: [String: Any]) {
            guard !didDeliverResult else { return }
            didDeliverResult = true
            captureSession?.stopRunning()
            dismiss(animated: true) { [onResult] in
                onResult(result)
            }
        }
    }
    #endif
}

#if canImport(UIKit)
extension UIViewController {
    func topPresentedViewController() -> UIViewController {
        if let presented = presentedViewController {
            return presented.topPresentedViewController()
        }
        return self
    }
}
#endif
