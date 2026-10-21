import Foundation

/// Runs `registerAppFunctionHandler` handlers for App Intents generated with `handler: "js"`.
///
/// The generated intent calls `call(name:argsJson:timeoutMs:)`. Calls wait in a queue until JS
/// has subscribed (`AppFunctions.ready()` from the library's JS), are then emitted as `onCall`
/// events, and complete when JS answers with `completeCall` / `failCall`, or fail after the timeout.
@objc(AppFunctionsJsBridge)
public final class AppFunctionsJsBridge: NSObject, @unchecked Sendable {  // State is guarded by `lock`.
  @objc public static let shared = AppFunctionsJsBridge()

  /// A failed call. `code` is an `AppFunctionErrorCode`, `UNKNOWN`, `NOT_REGISTERED` or `TIMEOUT`.
  public struct Failure: Error {
    public let code: String
    public let message: String
  }

  private let lock = NSLock()
  private var pending: [String: CheckedContinuation<String, Error>] = [:]
  private var queued: [[String: String]] = []
  private var emitter: (([String: String]) -> Void)?

  /// Runs the JS handler `name` with JSON arguments and returns its JSON result.
  public func call(name: String, argsJson: String, timeoutMs: Int) async throws -> String {
    let callId = UUID().uuidString
    return try await withTaskCancellationHandler {
      try await withCheckedThrowingContinuation { (cont: CheckedContinuation<String, Error>) in
        let event = ["callId": callId, "name": name, "argsJson": argsJson]
        lock.lock()
        pending[callId] = cont
        let emit = emitter
        if emit == nil { queued.append(event) }
        lock.unlock()
        emit?(event)
        DispatchQueue.global().asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) { [weak self] in
          self?.finish(
            callId,
            .failure(Failure(code: "TIMEOUT", message: "JS handler \"\(name)\" did not respond within \(timeoutMs) ms")))
        }
      }
    } onCancel: {
      finish(callId, .failure(CancellationError()))
    }
  }

  /// Called by the module when JS has subscribed to `onCall`. Delivers queued calls.
  @objc public func setEmitter(_ emit: @escaping ([String: String]) -> Void) {
    lock.lock()
    emitter = emit
    let events = queued
    queued.removeAll()
    lock.unlock()
    events.forEach(emit)
  }

  /// Called when the module is invalidated (e.g. a JS reload). New calls queue until `ready()`.
  @objc public func clearEmitter() {
    lock.lock()
    emitter = nil
    lock.unlock()
  }

  @objc public func complete(_ callId: String, resultJson: String) {
    finish(callId, .success(resultJson))
  }

  @objc public func fail(_ callId: String, code: String, message: String) {
    finish(callId, .failure(Failure(code: code, message: message)))
  }

  /// Resumes a pending call once; later results for the same call (e.g. after a timeout) are ignored.
  private func finish(_ callId: String, _ result: Result<String, Error>) {
    lock.lock()
    let cont = pending.removeValue(forKey: callId)
    queued.removeAll { $0["callId"] == callId }
    lock.unlock()
    cont?.resume(with: result)
  }
}
