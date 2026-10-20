import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    // AppFunctions: native handlers for App Intents (works without the JS runtime).
    AppFunctionsRegistry.handlers = ExampleAppFunctionsHandlers()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "AppFunctionsExample",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

/// Stand-in for the field-agent app's SQLite query (same records as the Android example).
struct ExampleAppFunctionsHandlers: AppFunctionsHandlers {
  struct ListToday: ListTodaysRecordsHandler {
    func listTodaysRecords() async throws -> [FieldRecord] {
      let today = Calendar.current.startOfDay(for: Date())
      let at = { (h: Int, m: Int) in Calendar.current.date(byAdding: DateComponents(hour: h, minute: m), to: today) }
      return [
        FieldRecord(id: "rec-001", title: "Inspect water pump, Site A", status: "DONE", scheduledAt: at(8, 30)),
        FieldRecord(id: "rec-002", title: "Meter reading, Block 4", status: "IN_PROGRESS", scheduledAt: at(11, 0)),
        FieldRecord(id: "rec-003", title: "Customer follow-up call", status: "PENDING", scheduledAt: nil),
      ]
    }
  }

  var listTodaysRecordsHandler: ListTodaysRecordsHandler { ListToday() }
}
