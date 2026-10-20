import XCTest

/// Drives Apple's Shortcuts app to run this app's App Intents, as a user would.
/// Run: xcodebuild test -scheme AppFunctionsExampleUITests -destination 'platform=iOS Simulator,…'
final class ShortcutsIntentTests: XCTestCase {
  let shortcuts = XCUIApplication(bundleIdentifier: "com.apple.shortcuts")

  override func setUp() {
    continueAfterFailure = false
  }

  func testRunListTodaysRecords() {
    shortcuts.launch()
    shortcuts.buttons["Create Shortcut"].tap()
    let search = shortcuts.searchFields["Search Actions"]
    XCTAssertTrue(search.waitForExistence(timeout: 10))
    focus(search)
    search.typeText("List Todays Records")
    sleep(2)
    attach("search")
    let action = shortcuts.cells.containing(.staticText, identifier: "List Todays Records").firstMatch
    XCTAssertTrue(action.waitForExistence(timeout: 10), "action not found in Shortcuts")
    action.tap()
    sleep(2)
    attach("added")

    shortcuts.buttons["play"].tap()
    // Shortcuts renders action results in a view that isn't exposed to UI testing, so the
    // returned rows are verified from the attached screenshot (and the app log). Here we only
    // assert the run produced no error alert.
    sleep(8)
    XCTAssertEqual(shortcuts.alerts.count, 0, "Shortcuts showed an error: \(shortcuts.alerts.firstMatch.label)")
    attach("result")
  }

  /// The first tap only expands the actions sheet; keep tapping until the field has focus.
  private func focus(_ field: XCUIElement) {
    for _ in 0..<4 {
      field.tap()
      sleep(1)
      if (field.value(forKey: "hasKeyboardFocus") as? Bool) == true { return }
    }
    XCTFail("could not focus \(field)")
  }

  private func attach(_ name: String) {
    let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    a.name = name
    a.lifetime = .keepAlways
    add(a)
  }
}
