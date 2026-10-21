# Decisions

Short log. Newest at the bottom.

## 2026-10-10: Scaffold with create-react-native-library on RN 0.87.1 (stable)

- **Decision:** Scaffold with `create-react-native-library@0.63.1`: Turbo Module, Kotlin (`kotlin-objc`), vanilla (Community CLI) example app on `react-native@0.87.1`, tools `eslint` + `jest`.
  - Command run: `npx create-react-native-library@0.63.1 --no-interactive --directory react-native-app-functions --slug react-native-app-functions --type turbo-module --languages kotlin-objc --example vanilla --tools eslint jest --react-native-version 0.87.1 …`
  - The tool warned that 0.87.1 is "untested" for this template version.
- **Alternatives:**
  - `create-expo-module@latest` (SDK 57): rejected. It uses RN 0.86 (AGP 8.12, compileSdk 36), and AppFunctions alpha10+ need AGP ≥ 9.1 and compileSdk 37.
  - `create-expo-module@next` (SDK 58, RN 0.88.0-rc): rejected because it means building on a beta SDK.
- **Reason:** It's a stable toolchain that meets the AppFunctions floor (AGP 9.2.1, compileSdk 37, Kotlin 2.2.0), with no Expo dependency for bare consumers. Chosen by the author.
- **Consequence:** The example is a bare app, so Expo config plugins don't run in it. Codegen will run from a Node entry point invoked by a Gradle task, which bare apps need anyway. An Expo config plugin can wrap the same codegen later.

## 2026-10-10: Kotlin package `io.github.alvinotuya.appfunctions`

- **Decision:** Library namespace/package `io.github.alvinotuya.appfunctions`. Example app `io.github.alvinotuya.appfunctions.example`.
- **Alternatives:** the scaffold defaults `com.appfunctions` / `appfunctions.example`, which are too generic and risk collisions.
- **Reason:** Reverse-domain on the author's GitHub namespace is the usual convention without an owned domain.

## 2026-10-10: Commit `example/android/` and hand-write Phase 1 there

- **Decision:** The example's native Android project is committed (it's a bare app). Phase 1 Kotlin is hand-written in the example app module.
- **Reason:** It follows the thin-slice rule (hand-write first) and needs no prebuild step. Approved by the author.

## 2026-10-10: `typescript` allowed as a codegen dependency

- **Decision:** Codegen may parse `appfunctions.config.ts` with the TypeScript compiler API (static, no code execution). Approved by the author. To be added in Phase 2.

## 2026-10-10: Generated Kotlin goes into the Kotlin `main` source set, not the Variant API

- **Decision:** `appfunctions.gradle` registers one `generateAppFunctions` task and adds its Kotlin output via `kotlin.sourceSets.main.kotlin.srcDir(task.flatMap { it.outputDir })`. The generated manifest and resources use the AGP Variant API (`addGeneratedManifestFile`, `sources.res.addGeneratedSourceDirectory`).
- **Alternatives:** `variant.sources.kotlin.addGeneratedSourceDirectory`. It's cleaner, but the spike showed KSP ignores those sources under RN 0.87's `builtInKotlin=false`.
- **Reason:** KSP must see the generated `@AppFunctionServiceEntryPoint` class. Revisit when RN drops the built-in-Kotlin opt-out (AGP 10).

## 2026-10-10: Phase 2 approvals

- Config format (PLAN.md §6.1), adding `jest` + `@types/jest` dev dependencies, and the `apply from: appfunctions.gradle` integration were approved by the author.

## 2026-10-10: Generated naming

- **Decision:** `appFunctionXmlFileName` = snake_case(`serviceName`) (Google sample convention). The handler aggregate interface is always `AppFunctionsHandlers`, with one `fun interface <Function>Handler` per function. Generated resources are prefixed `appfunctions_`. Manifest entries go in a generated overlay merged by AGP.
- **Alternatives:** keep Phase 1's `field_app_functions` / `FieldAppFunctionsHandlers` names, which can't be derived cleanly from config; or edit the app's own manifest, which hand-edits app files.
- **Reason:** Names are derivable and stable, can't collide with app resources, and the app's files stay untouched. Function IDs keep the Phase 1 shape `<kotlinPackage>.Base<serviceName>#<fn>`.

## 2026-10-10: Codegen regenerates on every build

- **Decision:** `generateAppFunctions` is never up to date (`upToDateWhen { false }`). The CLI rewrites only files whose content changed.
- **Reason:** It follows the CLAUDE.md rule "regenerate on every build", and unchanged output keeps KSP and compilation up to date (verified: an unchanged rebuild leaves `kspDebugKotlin` UP-TO-DATE).

## 2026-10-10: JS handlers via Headless JS driven from the AppFunction service

- **Decision:** Generated code calls `JsBridge` (library), which starts `ReactHost` if needed and runs a Headless JS task through `HeadlessJsTaskContext` (allowed in the foreground). Results return through the Turbo Module (`completeCall`/`failCall`). Arguments and results travel as JSON via generated `org.json` codecs. Handler TS types are derived from `typeof config`. The default timeout is 10 s, configurable with `timeoutMs`.
- **Alternatives:** `HeadlessJsTaskService` (a started service, subject to Android 12+ background-start limits, no result channel); runtime registration via `handleAppFunction` (Android 17 only, lifecycle-bound); kotlinx.serialization (a new dependency plus a compiler plugin).
- **Reason:** It works on a cold start and in the foreground, adds no dependencies, and keeps the library module free of the alpha `androidx.appfunctions` dependency (generated code maps failures to AppFunction exceptions). Approved by the author (PLAN.md §7).
- **Process note:** the JS Kotlin was hand-written as a fixture rather than in the app first, because the generator owns the service file. The first device build then caught a type-inference bug in the hand-written code. Fixture and template were fixed together.

## 2026-10-10: First npm release as `0.1.0-alpha.0` on the `alpha` dist-tag

- **Decision:** Publish `0.1.0-alpha.0` with `publishConfig.tag = "alpha"` and public access, before the auth gate, so the public can validate the approach. The README carries a prominent warning to expose only read-only, non-sensitive data.
- **Alternatives:** `0.1.0` on `latest`, which is easier to install but uses up 0.1.0 and looks more finished than it is; waiting for Phase 4.
- **Reason:** Author's choice: gather feedback first, then build auth. The packed tarball was validated in a fresh RN 0.87.1 app before release (see VERIFIED.md).

## 2026-10-20: iOS uses our own App Intents backend, not `expo-app-intents`

- **Decision:** Generate Swift `AppIntent`s from the same `appfunctions.config.ts` with our own codegen and runtime. Bare React Native is supported. Native Swift handlers come first, then a JS bridge that returns handler results to the system.
- **Alternatives:** `expo-app-intents` (alpha, Expo SDK 58 + prebuild only, intents hand-written in Swift, JS dispatch is one-way with no return value, reads only via pre-published entity catalogs); a hybrid with Expo's library as an optional extra later.
- **Reason:** Same semantics as Android (JS handlers return results), works in bare RN (the author's apps), and one config with one set of JS handlers serves both platforms. Chosen by the author.

## 2026-10-20: iOS codegen output and build integration

- **Decision:** The codegen writes one file, `<app source dir>/AppFunctions.generated.swift` (`--swift-out <file>`), gitignored and regenerated by an always-run Xcode "Run Script" phase placed before Compile Sources. `appfunctions_post_install(installer)` (`ios/appfunctions.rb`, called from the Podfile) adds that phase and the file reference idempotently with the `xcodeproj` gem, and generates the file once at `pod install`. The app source dir comes from the target's `INFOPLIST_FILE`. Node comes from `.xcode.env` / `.xcode.env.local` (`NODE_BINARY`), like RN's own phases.
- **Naming rules:** `<Type>` plain struct + `<Type>Entity: TransientAppEntity`; a field that clashes with an entity member (`id`, `displayRepresentation`) becomes `<type><Field>` (`id` → `fieldRecordId`); `<Function>Intent`; titles are derived from names (`listTodaysRecords` → "List Todays Records") unless the config sets `title`; the entity's display title/subtitle are its first two non-null, non-list string fields other than `id`; Swift keywords are backtick-escaped.
- **Alternatives:** a single-file output dir like Android's (unsafe: it would delete the app's own sources in that dir); committing the generated file; a manual one-time Xcode step instead of the Podfile helper.
- **Reason:** It matches the Android rule "regenerate on every build", leaves app files untouched, and the CLI only rewrites changed content, so unchanged builds don't recompile. Podfile helper approved by the author (PLAN.md §9.3).
- **Interim:** `js` functions are skipped on iOS (a comment lists them) until the JS bridge (slice 3). iOS-only problems (Swift-reserved names, declared-type params) fail only the iOS generation.

## 2026-10-21: iOS JS handlers via a Swift bridge in the library pod and an `onCall` event

- **Decision:** Generated `js` intents call `AppFunctionsJsBridge.shared.call(name:argsJson:timeoutMs:)`, a Swift class in the library pod (`import AppFunctions`; the podspec sets `DEFINES_MODULE`). The bridge queues calls until JS has subscribed, emits them through the TurboModule's typed event `onCall` (`CodegenTypes.EventEmitter`), and resumes the intent when JS answers with the existing `completeCall` / `failCall`, or fails it after `timeoutMs`. The library's JS subscribes on import (iOS only) and calls `ready()`. Arguments and results are JSON. The generated `AppFunctionsJson` codec mirrors Android's (ISO-8601 dates, strict decoding, the same error messages). Errors reach the user as the action's error message.
- **Alternatives:** `NotificationCenter` between generated code and the module, which has no compile-time link but no queue owner while JS starts (TurboModules are lazy); Objective-C runtime lookup (`NSClassFromString`); `expo-app-intents`-style one-way dispatch, which can't return results.
- **Reason:** The same JS handlers and semantics as Android (results return to the system, `AppFunctionError` messages, timeouts). The bridge is plain Swift concurrency with one lock, and the generated code stays in the app target. Slice 1 showed RN loads JS on a background intent launch, so waiting for `ready()` is enough.
