# react-native-app-functions

A React Native library that lets React Native apps (bare RN 0.87+ today, Expo later) expose functionality to on-device AI agents through Android **AppFunctions**, declared from TypeScript.

Android AppFunctions are the mobile equivalent of MCP tools: an app declares typed functions, the OS indexes them at install time, and a system agent (e.g. Gemini) discovers and executes them. The official API is Kotlin-only and annotation-driven: `@AppFunctionDeclaration` methods inside an abstract `AppFunctionService` annotated `@AppFunctionServiceEntryPoint`, processed by a KSP compiler. (`@AppFunction` was renamed in alpha13; `AppFunctionContext`/`AppFunctionConfiguration` were removed in alpha12.) This library bridges that to React Native.

## Golden rule: docs first, never from memory

The AppFunctions Jetpack library is in **alpha** and changes between releases. Expo, React Native and KSP also move quickly. Before writing or changing any code that touches these APIs:

1. Fetch the current official docs (list below) and confirm the exact API, artifact coordinates and versions.
2. Prefer official samples over blog posts. Ignore anything that contradicts the official docs.
3. Record what you verified in `docs/VERIFIED.md`: the fact, the source URL, and the date. Update it when you re-check.
4. If the docs are unclear or silent, say so and stop to ask. Do not guess an API.

### Sources to check

Android AppFunctions

- Overview: https://developer.android.com/ai/appfunctions
- Jetpack releases (current version + changelog): https://developer.android.com/jetpack/androidx/releases/appfunctions
- Official AppFunctions sample and testing tooling: find them from the overview page
- Platform API reference: `android.app.appfunctions`, and the `androidx.appfunctions` reference docs
- KSP setup: https://kotlinlang.org/docs/ksp-quickstart.html
- When reference pages are unreadable or docs are silent, read the published sources: the `-sources.jar` of `androidx.appfunctions:*` and `com.android.tools.build:gradle-api` on https://dl.google.com/android/maven2/, and AOSP AppSearch (`packages/modules/AppSearch`, `appsindexer/AppsUtil.java`) for how the platform indexes functions. These count as authoritative; note them as the source in `docs/VERIFIED.md`.

Expo / React Native

- Expo Modules API: https://docs.expo.dev/modules/get-started/
- create-expo-module: https://docs.expo.dev/more/create-expo-module/
- Config plugin + native module tutorial: https://docs.expo.dev/modules/config-plugin-and-native-module-tutorial/
- Config plugins: https://docs.expo.dev/config-plugins/introduction/
- Expo docs index for LLMs: https://docs.expo.dev/llms.txt
- Headless JS (Android): https://reactnative.dev/docs/headless-js-android
- Turbo Native Modules: https://reactnative.dev/docs/turbo-native-modules-introduction
- create-react-native-library (the scaffold we use): https://oss.callstack.com/react-native-builder-bob/create

## Core constraint: functions are defined at build time

The OS learns about AppFunctions from a schema packaged in the APK, generated at build time by Google's KSP processor from `@AppFunctionDeclaration`-annotated Kotlin. It indexes that schema at install time, without running the app. Therefore:

- Functions **cannot** be registered at runtime from JS.
- The library must **generate Kotlin source** from a static TypeScript config **before** KSP runs.
- Only function bodies are dynamic at runtime (they can read data, check session state, refuse, or delegate to JS).
- Runtime registration (`@AppFunctionSignature` + `AppFunctionManager.handleAppFunction`) exists but is experimental, Android 17-only, still needs a build-time signature, and lives only while the app is running. It does not change the above.
- Android 16 builds use a legacy (v1) indexer: the build must also emit `<name>-v1.xml` (KSP arg `appfunctions:generateV1Xml`) and declare it with the `android.app.appfunctions` service property. The codegen does this.

## Architecture

```
appfunctions.config.ts            (consumer app, static, source of truth)
        │  build time: Gradle task (android/appfunctions.gradle) runs the Node codegen
        ▼                         (an Expo config plugin wrapper comes later)
Generated Kotlin + manifest/res   Base<Service> with @AppFunctionDeclaration methods,
                                  @AppFunctionSerializable data classes, handler interfaces
        │  build time: Google's KSP processor (appfunctions-compiler)
        ▼
Schema XML + glue in the APK      indexed by Android at install time
        │  runtime: agent calls a function
        ▼
Generated body → handler          "native": Kotlin interface the app implements
                                  "js":     Headless JS task, awaited with a timeout
```

Layers:

1. **Config + TS API**: `defineAppFunctions({...})`, `registerAppFunctionHandler(name, fn)`, generated TS types for handler args/returns.
2. **Codegen** (Node CLI in `codegen/`, run by the `generateAppFunctions` Gradle task before KSP): parse config with the TS compiler API without executing it, validate types against what AppFunctions can serialize, render templates (`codegen/src/templates/`). Kotlin goes into the Kotlin `main` source set (KSP ignores AGP Variant API sources here); manifest and resources go in via the AGP Variant API.
3. **Android runtime** (Kotlin): `JsBridge` (start Headless JS task, `CompletableDeferred` + `withTimeout`, map errors), `AuthGate` (app-provided authorize hook), a native module for enable/disable/status.
4. **Dev harness**: an example-app screen that uses the AppFunctions client APIs to search and execute the app's own functions, so we can test without a system agent.

## Scope

- **v0**: Android only. Done: one `native` function end to end (Phase 1), codegen reproducing it (Phase 2), `js` handlers via Headless JS (Phase 3). **Next: Phase 4, the auth gate, confirmation and dev harness.** See `docs/PLAN.md`.
- **Later**: more types, multiple functions, generated TS types, iOS App Intents backend from the same config.
- Published to npm as alpha (`0.1.0-alpha.0`, dist-tag `alpha`, `publishConfig.tag` enforces it). The author publishes; keep `CHANGELOG.md` updated and validate the packed tarball in a fresh RN app before each release.
- Out of scope for now: iOS, docs site.

## Rules

- **Thin vertical slices.** Get one function working end to end before generalising. Hand-write the Kotlin first; only then write the generator, and diff its output against the hand-written file.
- **Pin versions.** The AppFunctions and KSP versions live only in `versions.json` (read by Gradle and the example). All codegen templates live in `codegen/src/templates/`, so an alpha upgrade touches those two places.
- **Generated code is output.** Never hand-edit generated files. Regenerate on every build. Mark them `// GENERATED — do not edit`.
- **Fail the build loudly** on unsupported config types, with a message naming the function and field.
- **Android version handling.** AppFunctions require Android 16+. The library must build and run on lower API levels as a no-op, not crash.
- **Security.** Every generated function calls the auth gate before doing anything. Destructive functions must be markable as "requires in-app confirmation".
- **Cold start.** Agent calls can arrive with the app killed. The `native` path must not depend on the JS runtime. Measure `js` path latency on a killed app.
- **Tests.** Unit-test the codegen (config in, Kotlin text out, snapshot). Unit-test type mapping. Use the harness for on-device checks.
- **Ask before** adding dependencies beyond the scaffold, changing the public API shape, or making any architectural decision not covered here.

## Working style

- Start each task in plan mode: research the docs, write a short plan, wait for approval.
- Keep `docs/DECISIONS.md` as a short log: decision, alternatives considered, reason, date.
- Keep `docs/VERIFIED.md` up to date (see golden rule).
- **Do not commit or push.** The author makes all commits. At the end of a working slice, leave the changes uncommitted and suggest a commit message.
- When something can't be verified on this machine (e.g. needs an Android 16 device or emulator), say exactly what the user should run and what output to look for.

## Repo map and commands

- `src/` RN runtime + `src/config.ts` (`defineAppFunctions`, exported as `react-native-app-functions/config`) · `codegen/` generator, tests, `__fixtures__/handwritten/` (the reference output) · `android/` library module + `appfunctions.gradle` · `example/` bare RN 0.87.1 app with committed `android/` and `appfunctions.config.ts`.
- Node 24 via `.nvmrc` (run `nvm use`; the nvm default on this machine is 22). `yarn prepare` builds `lib/` and `codegen/lib/` (needed before any Gradle build). `yarn test`, `yarn typecheck`, `yarn lint`.
- Build: `cd example/android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a`.
- Emulators: `AppFunctions_API_37` (Android 17) and `AppFunctions_API_36_1` (Android 16 QPR) have `cmd app_function`; `Pixel_9` is Android 16.0 (indexes v1 only, no `cmd`); `Medium_Phone_API_36.0` actually runs API 31.

## Context about the author

The author is a mobile engineer experienced with React Native (offline-first, SQLite, MMKV), Kotlin, and BLE. The first real consumer will be a field-agent app with local SQLite data, so a read-only "list today's records" style function is the reference use case. Explain Android build tooling decisions (KSP, Gradle source sets, codegen ordering) briefly when you make them.
