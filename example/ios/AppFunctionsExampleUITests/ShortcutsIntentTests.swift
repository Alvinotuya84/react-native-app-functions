import XCTest

/// Drives Apple's Shortcuts app to run App Intents, as a user would. Each test kills the app that
/// owns the action first, so every run is a cold start in the background.
/// Run: xcodebuild test -scheme AppFunctionsExampleUITests -destination 'platform=iOS Simulator,…'
class ShortcutsTestCase: XCTestCase {
  let shortcuts = XCUIApplication(bundleIdentifier: "com.apple.shortcuts")

  override func setUp() {
    continueAfterFailure = false
  }

  /// Kills `app`, opens a new shortcut, adds the action titled `title` and fills its text
  /// parameters in order.
  func addAction(_ title: String, of app: XCUIApplication, inputs: [String] = []) {
    // Launching once also makes Shortcuts pick up actions from a freshly installed build.
    app.launch()
    sleep(2)
    app.terminate()

    shortcuts.launch()
    shortcuts.buttons["Create Shortcut"].tap()
    let search = shortcuts.searchFields["Search Actions"]
    XCTAssertTrue(search.waitForExistence(timeout: 10))
    focus(search)
    search.typeText(title)
    sleep(2)
    attach("search")
    let action = shortcuts.cells.containing(.staticText, identifier: title).firstMatch
    XCTAssertTrue(action.waitForExistence(timeout: 10), "action not found in Shortcuts")
    action.tap()
    sleep(2)
    for (i, input) in inputs.enumerated() {
      let field = shortcuts.textFields.element(boundBy: i)
      XCTAssertTrue(field.waitForExistence(timeout: 5), "no parameter field #\(i)")
      if (field.value(forKey: "hasKeyboardFocus") as? Bool) != true { field.tap() }
      // Return closes the keyboard, so the next tap reaches "play" and not the dictation key.
      field.typeText(input + "\n")
      sleep(1)
    }
    attach("added")
  }

  /// Runs the shortcut. Shortcuts renders action results in a view that isn't exposed to UI
  /// testing, so returned values are checked from the attached screenshots.
  func runShortcut(wait: UInt32 = 8) {
    let notNow = shortcuts.buttons["Not Now"]
    if notNow.exists { notNow.tap() }
    shortcuts.buttons["play"].tap()
    sleep(wait)
    print("SCREEN-ALERTS>>\(shortcuts.alerts.count) \(alertText())<<")
  }

  func alertText() -> String {
    let alert = shortcuts.alerts.firstMatch
    guard alert.exists else { return "" }
    return ([alert.label] + alert.staticTexts.allElementsBoundByIndex.map(\.label)).joined(separator: " | ")
  }

  func assertNoError() {
    XCTAssertEqual(shortcuts.alerts.count, 0, "Shortcuts showed an error: \(alertText())")
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

  func attach(_ name: String) {
    let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    a.name = name
    a.lifetime = .keepAlways
    add(a)
  }
}

/// The example app's actions: one `native` and one `js` function.
final class ShortcutsIntentTests: ShortcutsTestCase {
  let app = XCUIApplication()

  /// `native` handler (Swift, no JS involved).
  func testRunListTodaysRecords() {
    addAction("List Todays Records", of: app)
    runShortcut()
    assertNoError()
    attach("result")
  }

  /// `js` handler: the app is launched in the background and the call goes through the JS bridge.
  func testRunFindRecordJs() {
    addAction("Find Record", of: app, inputs: ["rec-002"])
    runShortcut()
    assertNoError()
    attach("result")
  }

  /// A JS `AppFunctionError` reaches the user as the action's error message.
  func testFindRecordJsErrorMessage() {
    addAction("Find Record", of: app, inputs: ["nope"])
    runShortcut()
    XCTAssertTrue(shortcuts.alerts.firstMatch.waitForExistence(timeout: 10), "expected an error alert")
    attach("error")
    XCTAssertTrue(alertText().contains("No record with id \"nope\""), alertText())
  }

  /// A handler that doesn't answer within `timeoutMs` (10 s) fails the action with a clear message.
  func testFindRecordJsTimeout() {
    addAction("Find Record", of: app, inputs: ["test-timeout"])
    runShortcut(wait: 14)
    XCTAssertTrue(shortcuts.alerts.firstMatch.waitForExistence(timeout: 10), "expected an error alert")
    attach("timeout")
    XCTAssertTrue(alertText().contains("did not respond within 10000 ms"), alertText())
  }
}

/// Use cases for the Notes showcase app (examples/notes), whose four functions are all `js`.
/// Needs the Notes app installed on the simulator; skipped otherwise.
final class NotesShortcutsDemoTests: ShortcutsTestCase {
  let notes = XCUIApplication(bundleIdentifier: "io.github.alvinotuya.notes")

  override func setUpWithError() throws {
    try super.setUpWithError()
    try XCTSkipIf(
      ProcessInfo.processInfo.environment["NOTES_DEMO"] != "1",
      "set TEST_RUNNER_NOTES_DEMO=1 with the Notes app installed")
  }

  /// "Note down: call the plumber…" → Create Note runs in the background; the note shows in the app.
  func test1CreateNote() {
    addAction("Create Note", of: notes, inputs: ["Call the plumber", "Kitchen sink is leaking. Call before Friday."])
    runShortcut()
    assertNoError()
    attach("result")
    notes.activate()
    sleep(3)
    attach("notes app")
  }

  /// "What did I note about the plumber?" → Search Notes returns matching notes.
  func test2SearchNotes() {
    addAction("Search Notes", of: notes, inputs: ["plumber"])
    runShortcut()
    assertNoError()
    attach("result")
  }

  /// "Show my latest notes" → List Recent Notes (optional limit).
  func test3ListRecentNotes() {
    addAction("List Recent Notes", of: notes, inputs: ["3"])
    runShortcut()
    assertNoError()
    attach("result")
  }
}
