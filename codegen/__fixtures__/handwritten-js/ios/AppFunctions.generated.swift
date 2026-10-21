// GENERATED — do not edit. Source: appfunctions.config.ts (react-native-app-functions).
import AppFunctions
import AppIntents
import Foundation

/// A field record scheduled for the current day.
struct FieldRecord {
  /// The unique identifier of the record.
  var id: String
  /// A short human-readable title describing the visit or task.
  var title: String
  /// The record status, one of "PENDING", "IN_PROGRESS" or "DONE".
  var status: String
  /// The local date and time the record is scheduled for, or null if unscheduled.
  var scheduledAt: Date?
}

/// Native implementation of the `listTodaysRecords` AppFunction, provided by the app.
protocol ListTodaysRecordsHandler {
  func listTodaysRecords() async throws -> [FieldRecord]
}

/// Implemented by the app and registered in `AppFunctionsRegistry.handlers` at launch, so the
/// App Intents can reach the handlers without depending on React Native.
protocol AppFunctionsHandlers {
  var listTodaysRecordsHandler: ListTodaysRecordsHandler { get }
}

enum AppFunctionsRegistry {
  /// Set this in `application(_:didFinishLaunchingWithOptions:)`.
  static var handlers: AppFunctionsHandlers?
}

/// An error whose message Shortcuts and Siri show to the user.
@available(iOS 16.0, *)
struct AppFunctionsIntentError: Error, CustomLocalizedStringResourceConvertible {
  let message: String
  var localizedStringResource: LocalizedStringResource {
    LocalizedStringResource(stringLiteral: message)
  }
}

/// JSON encoding for values exchanged with JS handlers. Dates and times are ISO-8601 strings;
/// decoding is strict and reports the path of the first invalid value.
@available(iOS 16.0, *)
enum AppFunctionsJson {
  struct InvalidValue: Error {
    let message: String
  }

  /// Runs the JS handler `name` and decodes its result. Failures become messages for the user.
  static func call<T>(
    _ name: String, _ args: [String: Any], timeoutMs: Int, decode: (Any) throws -> T
  ) async throws -> T {
    let argsJson = String(decoding: try JSONSerialization.data(withJSONObject: args), as: UTF8.self)
    let resultJson: String
    do {
      resultJson = try await AppFunctionsJsBridge.shared.call(
        name: name, argsJson: argsJson, timeoutMs: timeoutMs)
    } catch let failure as AppFunctionsJsBridge.Failure {
      throw AppFunctionsIntentError(message: failure.message)
    }
    do {
      let result = try JSONSerialization.jsonObject(
        with: Data(resultJson.utf8), options: .fragmentsAllowed)
      return try decode(result)
    } catch let invalid as InvalidValue {
      throw AppFunctionsIntentError(message: "\"\(name)\" returned an invalid value: \(invalid.message)")
    } catch {
      throw AppFunctionsIntentError(message: "\"\(name)\" returned invalid JSON")
    }
  }

  static func decodeFieldRecord(_ v: Any?, _ path: String) throws -> FieldRecord {
    let o = try obj(v, path)
    return try FieldRecord(
      id: string(o["id"], path + ".id"),
      title: string(o["title"], path + ".title"),
      status: string(o["status"], path + ".status"),
      scheduledAt: orNil(o["scheduledAt"]) { try localDateTime($0, path + ".scheduledAt") }
    )
  }

  static func orNull<T>(_ v: T?, _ encode: (T) -> Any) -> Any {
    v.map(encode) ?? NSNull()
  }

  static func orNil<T>(_ v: Any?, _ decode: (Any) throws -> T) rethrows -> T? {
    guard let v = v, !(v is NSNull) else { return nil }
    return try decode(v)
  }

  static func obj(_ v: Any?, _ path: String) throws -> [String: Any] {
    guard let o = v as? [String: Any] else { throw invalid(path, "an object", v) }
    return o
  }

  static func string(_ v: Any?, _ path: String) throws -> String {
    guard let s = v as? String else { throw invalid(path, "a string", v) }
    return s
  }

  static func boolean(_ v: Any?, _ path: String) throws -> Bool {
    guard let n = v as? NSNumber, isBool(n) else { throw invalid(path, "a boolean", v) }
    return n.boolValue
  }

  static func double(_ v: Any?, _ path: String) throws -> Double {
    guard let n = v as? NSNumber, !isBool(n) else { throw invalid(path, "a number", v) }
    return n.doubleValue
  }

  static func long(_ v: Any?, _ path: String) throws -> Int {
    guard let n = v as? NSNumber, !isBool(n), let i = Int(exactly: n.doubleValue) else {
      throw invalid(path, "an integer", v)
    }
    return i
  }

  static func int(_ v: Any?, _ path: String) throws -> Int {
    let i = try long(v, path)
    guard Int(Int32.min)...Int(Int32.max) ~= i else { throw invalid(path, "a 32-bit integer", v) }
    return i
  }

  static func localDate(_ v: Any?, _ path: String) throws -> Date {
    try parse(v, path, "an ISO-8601 date like 2026-10-10", ["yyyy-MM-dd"])
  }

  static func localDateTime(_ v: Any?, _ path: String) throws -> Date {
    try parse(
      v, path, "an ISO-8601 local date-time like 2026-10-10T08:30",
      ["yyyy-MM-dd'T'HH:mm", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd'T'HH:mm:ss.SSS"])
  }

  static func instant(_ v: Any?, _ path: String) throws -> Date {
    let s = try string(v, path)
    for options: ISO8601DateFormatter.Options in [
      [.withInternetDateTime], [.withInternetDateTime, .withFractionalSeconds],
    ] {
      let f = ISO8601DateFormatter()
      f.formatOptions = options
      if let d = f.date(from: s) { return d }
    }
    throw invalid(path, "an ISO-8601 instant like 2026-10-10T08:30:00Z", v)
  }

  static func list<T>(_ v: Any?, _ path: String, _ item: (Any?, String) throws -> T) throws -> [T] {
    guard let a = v as? [Any] else { throw invalid(path, "an array", v) }
    return try a.enumerated().map { try item($0.element, "\(path)[\($0.offset)]") }
  }

  /// Local dates and date-times use the device's current time zone.
  static func encodeLocalDate(_ d: Date) -> String { formatter("yyyy-MM-dd").string(from: d) }

  static func encodeLocalDateTime(_ d: Date) -> String {
    formatter("yyyy-MM-dd'T'HH:mm:ss").string(from: d)
  }

  static func encodeInstant(_ d: Date) -> String { ISO8601DateFormatter().string(from: d) }

  private static func formatter(_ format: String) -> DateFormatter {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.calendar = Calendar(identifier: .iso8601)
    f.timeZone = TimeZone.current
    f.dateFormat = format
    f.isLenient = false
    return f
  }

  private static func parse(_ v: Any?, _ path: String, _ expected: String, _ formats: [String]) throws -> Date {
    let s = try string(v, path)
    for format in formats {
      if let d = formatter(format).date(from: s) { return d }
    }
    throw invalid(path, expected, v)
  }

  private static func isBool(_ n: NSNumber) -> Bool { CFGetTypeID(n) == CFBooleanGetTypeID() }

  private static func invalid(_ path: String, _ expected: String, _ v: Any?) -> InvalidValue {
    guard let v = v, !(v is NSNull) else {
      return InvalidValue(message: "\(path) is missing or null, expected \(expected)")
    }
    return InvalidValue(message: "\(path): expected \(expected), got \(describe(v))")
  }

  private static func describe(_ v: Any) -> String {
    switch v {
    case is [String: Any]: return "an object"
    case is [Any]: return "an array"
    case let s as String: return "\"\(s.prefix(40))\""
    case let n as NSNumber where isBool(n): return n.boolValue ? "true" : "false"
    default: return "\(v)"
    }
  }
}

@available(iOS 16.0, *)
struct FieldRecordEntity: TransientAppEntity {
  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Field Record"

  @Property(title: "Id")
  var fieldRecordId: String
  @Property(title: "Title")
  var title: String
  @Property(title: "Status")
  var status: String
  @Property(title: "Scheduled At")
  var scheduledAt: Date?

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(title)", subtitle: "\(status)")
  }

  init() {}

  init(_ value: FieldRecord) {
    fieldRecordId = value.id
    title = value.title
    status = value.status
    scheduledAt = value.scheduledAt
  }
}

@available(iOS 16.0, *)
struct ListTodaysRecordsIntent: AppIntent {
  static let title: LocalizedStringResource = "List Todays Records"
  static let description = IntentDescription(
    "Lists the field records scheduled for today on this device, ordered by scheduled time. Read-only: does not modify any record."
  )

  func perform() async throws -> some IntentResult & ReturnsValue<[FieldRecordEntity]> {
    guard let handlers = AppFunctionsRegistry.handlers else {
      throw AppFunctionsIntentError(message: "The app did not register AppFunctionsHandlers")
    }
    let value = try await handlers.listTodaysRecordsHandler.listTodaysRecords()
    return .result(value: value.map(FieldRecordEntity.init))
  }
}

@available(iOS 16.0, *)
struct FindRecordIntent: AppIntent {
  static let title: LocalizedStringResource = "Find Record"
  static let description = IntentDescription(
    "Finds one field record by its id. Read-only. Ids come from listTodaysRecords."
  )

  @Parameter(title: "Id", description: "The record id, e.g. \"rec-001\".")
  var id: String

  func perform() async throws -> some IntentResult & ReturnsValue<FieldRecordEntity> {
    let args: [String: Any] = [
      "id": id,
    ]
    let value: FieldRecord = try await AppFunctionsJson.call(
      "findRecord", args, timeoutMs: 10000
    ) { result in
      try AppFunctionsJson.decodeFieldRecord(result, "result")
    }
    return .result(value: FieldRecordEntity(value))
  }
}
