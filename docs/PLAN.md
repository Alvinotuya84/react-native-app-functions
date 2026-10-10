# Plan

Status: **approved 2026-10-10** with the RN 0.87.1 fallback (see `DECISIONS.md`). Facts referenced here are in `VERIFIED.md`.

## 0. Two findings that changed the kickoff assumptions

1. **The toolchain floor is AGP 9.1 + compileSdk 37.** Every AppFunctions alpha since alpha10 requires that. Expo SDK 57 (RN 0.86) is below it. RN 0.87.1 meets it, and so does Expo SDK 58 once stable. Consumer apps need RN ≥ 0.87.
2. **The API moved.** `@AppFunction` is now `@AppFunctionDeclaration` (alpha13). `AppFunctionContext` and `AppFunctionConfiguration` are gone (alpha12). Functions live in an abstract `AppFunctionService` subclass annotated `@AppFunctionServiceEntryPoint`. KSP generates the concrete service and the XML. The manifest entry is written by us. Runtime registration is Android 17-only and lifecycle-bound, so build-time codegen stays.

## 1. Scaffold

`create-react-native-library@0.63.1`, Turbo Module, Kotlin, vanilla RN 0.87.1 example, eslint + jest. The exact command is in `DECISIONS.md`. Node is pinned via `.nvmrc` (24.14.1).

## 2. Repository layout

```
react-native-app-functions/
  src/                         TS public API: defineAppFunctions, registerAppFunctionHandler, types
  android/                     library Gradle module (Kotlin runtime)
    src/main/java/io/github/alvinotuya/appfunctions/
                               AppFunctionsModule (Turbo Module), later JsBridge, AuthGate
  codegen/                     Node codegen (Phase 2)
    src/                       config parsing (TS compiler API), type mapping, validation, render
    src/templates/             ALL Kotlin/XML templates (alpha upgrades touch only this + versions.ts)
    src/versions.ts            single pin: APPFUNCTIONS_VERSION = "1.0.0-alpha13", KSP version
    __tests__/                 snapshot + type-mapping tests
    __fixtures__/handwritten/  the Phase 1 Kotlin/manifest, used as the codegen diff target
  example/                     bare RN 0.87.1 app, android/ committed
    appfunctions.config.ts     (Phase 2)
  docs/  VERIFIED.md  PLAN.md  DECISIONS.md
```

An Expo config plugin (`plugin/`, `app.plugin.js`) comes later as a thin wrapper over `codegen/`.

## 3. Phase 1: one hand-written function, end to end

Goal: `listTodaysRecords` shows up in `list-app-functions` and returns dummy records via `execute-app-function`, with the app killed.

**Build tooling, briefly:** KSP is a compiler plugin that reads annotated Kotlin and emits more Kotlin plus resources at build time. The AppFunctions processor emits the concrete service class and `assets/<name>.xml`, and the OS indexes that XML at install time. KSP runs per Gradle module. The module that holds the entry point runs the processor, and the app module must run it with `aggregateAppFunctions=true` so all functions merge into the app's inventory. In Phase 1 both are the app module.

Steps:
1. Root `example/android/build.gradle`: add the KSP Gradle plugin to the buildscript classpath, at a version that works with Kotlin 2.2.0.
2. `example/android/app/build.gradle`: apply `com.google.devtools.ksp`, add `implementation`/`ksp` for `appfunctions` + `appfunctions-compiler` `1.0.0-alpha13`, and set `ksp { arg("appfunctions:aggregateAppFunctions", "true") }`.
3. Hand-write the Kotlin in the example app module (`.../example/appfunctions/`):
   - `BaseFieldAppFunctionService`: `@RequiresApi(36)`, `@AppFunctionServiceEntryPoint(serviceName = "FieldAppFunctionService", appFunctionXmlFileName = "field_app_functions")`, extends `AppFunctionService`.
   - `@AppFunctionDeclaration(isDescribedByKDoc = true) suspend fun listTodaysRecords(): List<FieldRecord>`, run on `Dispatchers.IO` and delegating to a `ListTodaysRecordsHandler` that the service gets from `applicationContext` (the documented service-locator pattern). `MainApplication` implements it with dummy data. That path never touches React Native or JS.
   - `@AppFunctionSerializable(isDescribedByKDoc = true) data class FieldRecord(id, title, status, scheduledAt: LocalDateTime?)` with inline KDoc per property.
4. Manifest: `<service>` for the generated `FieldAppFunctionService` (permission, exported, two `<property>`s, intent-filter, `tools:targetApi="36"`), plus the `app_metadata` property and `res/xml/app_metadata.xml`.
5. Copy the Kotlin and manifest snippet into `codegen/__fixtures__/handwritten/` in Phase 2, when that folder exists.

**Verification (needs an Android 16+ device or emulator; you run it):**
```sh
adb shell cmd app_function help                      # must print help, not "Can't find service"
adb shell cmd app_function list-app-functions | grep -A40 io.github.alvinotuya.appfunctions.example
adb shell am force-stop io.github.alvinotuya.appfunctions.example
time adb shell "cmd app_function execute-app-function \
  --package io.github.alvinotuya.appfunctions.example \
  --function '<id from list output>' --parameters '{}'"
```
Expected: JSON containing three dummy records. Also install on an API ≤ 35 emulator: the app must launch normally.

## 4. Later phases (high level)

**Phase 2: codegen reproduces Phase 1.**
- `defineAppFunctions({...})` in `example/appfunctions.config.ts`, parsed statically with the TypeScript compiler API. Only literal object expressions are accepted, and app code is never executed.
- Validate types against the serializable list, failing loudly with the function and field name. Render templates into `example/android/app/build/generated/appfunctions/` and register that as a source dir.
- Entry point: a Node CLI (`react-native-app-functions codegen`) invoked by a Gradle task that `preBuild` depends on, so it runs before KSP on every build. The library ships an `appfunctions.gradle` script for the app to `apply from:`. Manifest entries are emitted as a generated manifest merged by AGP, not by editing the app's manifest.
- Done when the generated output diffs clean against `__fixtures__/handwritten/` (modulo the GENERATED header), and the hand-written files are deleted.
- Tests: Jest snapshot (config → Kotlin) and type-mapping unit tests.

**Phase 3: `handler: "js"` via Headless JS.**
- Generated body calls `JsBridge.invoke(name, argsJson)`. `JsBridge` starts a headless task, waits on a `CompletableDeferred`, and wraps it in `withTimeout`. It maps JS errors and timeouts to `AppFunctionAppUnknownException` / `AppFunctionCancelledException`.
- First read RN 0.88's `HeadlessJsTaskService`/`HeadlessJsTaskContext` source for bridgeless support. We're already inside a bound service, so we may drive `HeadlessJsTaskContext` directly instead of `startForegroundService`.
- Must set `allowedInForeground = true`, or the call crashes when the app is open.
- Measure killed-app latency (force-stop → execute), including the timeout tuned against it.

**Phase 4: auth gate, confirmation, harness.**
- `AuthGate` is called first in every generated body. The app provides it, and it throws `AppFunctionDeniedException` / `AppFunctionPermissionRequiredException`.
- `requiresConfirmation: true` returns a `PendingIntent` into an in-app confirm screen instead of acting. That pattern is in the sample's `makeCall`; the exact design comes later.
- Consider `@AppFunctionAccessLevel` (experimental).
- Native module: `setEnabled` / `isEnabled` / `isSupported` (via `AppFunctionManager.getInstance` = null).
- Example harness screen: `searchAppFunctions` (own package, no permission) + `executeAppFunction`. Open question 4 in VERIFIED.md.

## 5. Risks and unknowns

- **Alpha churn (high).** The last 4 alphas renamed or removed core annotations, and the official docs, sample and Google skill already lag alpha13. Mitigation: one version pin, one template folder, re-verify on every bump, keep the Phase 1 fixture as a canary.
- **New toolchain (medium).** AGP 9 is new for RN; RN 0.87.1 opts out of built-in Kotlin (`android.builtInKotlin=false`), and AGP 10 will remove that opt-out. create-react-native-library marked 0.87.1 "untested". Consumer apps must be on RN ≥ 0.87 — check the field-agent app.
- **Cold-start latency (medium).** Binding the service runs `Application.onCreate`, and in RN apps that includes `loadReactNative`/SoLoader. The native path should stay fast but must be measured. The JS path adds a full JS runtime boot plus bundle load. The agent's timeout budget is undocumented.
- **Headless JS on bridgeless (medium).** Undocumented. It also crashes if the app is foregrounded unless configured.
- **Device availability (medium).** Needs Android 16+ with the `app_function` system service. Unverified: whether stock API 36 emulator images ship it. If not, a physical Pixel on Android 16 is needed.
- **Expo consumers (low for now).** Codegen runs from a Gradle task, so Expo apps work after prebuild; a config plugin wrapper (manifest + `apply from`) comes later.
- **Serialization gaps.** No `Map`, no enums (use `String` + `@AppFunctionStringValueConstraint`), constructor defaults ignored. Codegen must reject or translate these.
