// GENERATED — do not edit. Source: appfunctions.config.ts (react-native-app-functions).
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
