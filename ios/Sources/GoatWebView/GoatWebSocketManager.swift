import Foundation

public protocol GoatWebSocketSession: AnyObject {
    func resume()
    func sendText(_ text: String, completion: @escaping (Error?) -> Void)
    func sendData(_ data: Data, completion: @escaping (Error?) -> Void)
    func close(code: Int, reason: String?)
}

final class GoatNativeWebSocketSession: GoatWebSocketSession {
    private let task: URLSessionWebSocketTask

    init(task: URLSessionWebSocketTask) {
        self.task = task
    }

    func resume() {
        task.resume()
    }

    func sendText(_ text: String, completion: @escaping (Error?) -> Void) {
        task.send(.string(text), completionHandler: completion)
    }

    func sendData(_ data: Data, completion: @escaping (Error?) -> Void) {
        task.send(.data(data), completionHandler: completion)
    }

    func close(code: Int, reason: String?) {
        let closeCode = URLSessionWebSocketTask.CloseCode(rawValue: code) ?? .normalClosure
        task.cancel(with: closeCode, reason: reason?.data(using: .utf8))
    }
}

public final class GoatWebSocketManager: @unchecked Sendable {
    public static let shared = GoatWebSocketManager()

    public typealias SocketTaskFactory = (URL) -> GoatWebSocketSession

    private let lock = NSLock()
    private var sockets: [String: GoatWebSocketSession] = [:]
    private let taskFactory: SocketTaskFactory

    public static let defaultTaskFactory: SocketTaskFactory = { url in
        GoatNativeWebSocketSession(task: URLSession.shared.webSocketTask(with: url))
    }

    public init(taskFactory: @escaping SocketTaskFactory = GoatWebSocketManager.defaultTaskFactory) {
        self.taskFactory = taskFactory
    }

    public func connect(url: URL) throws -> [String: Any] {
        guard let scheme = url.scheme?.lowercased(), scheme == "ws" || scheme == "wss" else {
            throw GoatBridgeError.invalidPayload("WEBSOCKET_CONNECT requires a ws:// or wss:// URL")
        }
        let socketId = "ws_\(UUID().uuidString.prefix(8))"
        let session = taskFactory(url)
        session.resume()
        lock.lock()
        sockets[socketId] = session
        lock.unlock()
        return [
            "connected": true,
            "socketId": socketId,
            "url": url.absoluteString
        ]
    }

    public func send(socketId: String, message: String?) async throws -> [String: Any] {
        let session = try requireSocket(socketId: socketId)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            session.sendText(message ?? "") { error in
                if let error = error {
                    continuation.resume(throwing: GoatBridgeError.invalidPayload("WEBSOCKET_SEND failed for '\(socketId)': \(error.localizedDescription)"))
                } else {
                    continuation.resume()
                }
            }
        }
        return ["sent": true, "socketId": socketId]
    }

    public func sendData(socketId: String, data: Data) async throws -> [String: Any] {
        let session = try requireSocket(socketId: socketId)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            session.sendData(data) { error in
                if let error = error {
                    continuation.resume(throwing: GoatBridgeError.invalidPayload("WEBSOCKET_SEND failed for '\(socketId)': \(error.localizedDescription)"))
                } else {
                    continuation.resume()
                }
            }
        }
        return ["sent": true, "socketId": socketId, "byteLength": data.count]
    }

    public func close(socketId: String, code: Int, reason: String?) throws -> [String: Any] {
        let session = try requireSocket(socketId: socketId)
        session.close(code: code, reason: reason)
        lock.lock()
        sockets.removeValue(forKey: socketId)
        lock.unlock()
        return ["closed": true, "socketId": socketId]
    }

    public func activeSocketCount() -> Int {
        lock.lock()
        defer { lock.unlock() }
        return sockets.count
    }

    private func requireSocket(socketId: String) throws -> GoatWebSocketSession {
        lock.lock()
        let session = sockets[socketId]
        lock.unlock()
        guard let session = session else {
            throw GoatBridgeError.invalidPayload("UNKNOWN_SOCKET: no active WebSocket task for '\(socketId)'")
        }
        return session
    }
}
