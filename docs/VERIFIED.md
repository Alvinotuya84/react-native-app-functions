# Verified facts

Every entry: fact, source, date checked. Re-check before relying on anything older than the current AppFunctions alpha.

Legend for sources:
- **REL** = https://developer.android.com/jetpack/androidx/releases/appfunctions
- **OVR** = https://developer.android.com/ai/appfunctions
- **SRC13** = `androidx.appfunctions:appfunctions:1.0.0-alpha13` sources jar + AAR from https://dl.google.com/android/maven2/androidx/appfunctions/ (KDoc read directly; the developer.android.com reference pages are too nav-heavy to fetch reliably)
- **SAMPLE** = https://github.com/android/appfunctions (commit `5bd21cc`, 2026-10-06), `ChatApp/`
- **SKILL** = https://github.com/android/skills/tree/main/device-ai/appfunctions (commit `42dc227`, 2026-09-25)

## AppFunctions: versions and coordinates

| Fact | Source | Checked |
|---|---|---|
| Latest version is `1.0.0-alpha13`, released 2026-10-07. No beta/RC/stable exists. | REL; maven-metadata.xml on dl.google.com | 2026-10-10 |
| Artifacts: `androidx.appfunctions:appfunctions`, `androidx.appfunctions:appfunctions-compiler` (KSP), `androidx.appfunctions:appfunctions-testing`. All at `1.0.0-alpha13`. Hosted on Google Maven. | REL; Maven | 2026-10-10 |
| Setup: `implementation("androidx.appfunctions:appfunctions:<v>")` + `ksp("androidx.appfunctions:appfunctions-compiler:<v>")`. | REL | 2026-10-10 |
| AAR metadata for alpha10, 11, 12 and 13 all declare `minCompileSdk=37` and `minAndroidGradlePluginVersion=9.1.0`. | AAR `aar-metadata.properties` | 2026-10-10 |
| Library manifest: `minSdkVersion 24`; adds optional `<uses-library com.android.extensions.appfunctions>` and an internal `AppFunctionCallerVerificationReceiver`. So the dependency itself is safe on API 24+. | SRC13 AAR manifest | 2026-10-10 |
| `AppFunctionManager.getInstance(context)` returns `null` when unsupported. It is supported on SDK ≥ 36, or SDK ≥ 34 with the AppFunction extension library. Not supported in a profile user. | SRC13 `AppFunctionManager.kt` | 2026-10-10 |
| Feature runs on Android 16 (API 36)+. Sample service class is `@RequiresApi(36)`. Google's skill says target SDK 36+ and compileSdk 37+. | OVR, SAMPLE, SKILL | 2026-10-10 |
| Sample toolchain: AGP 9.3.1, Kotlin 2.4.10, KSP `com.google.devtools.ksp` 2.3.10, compileSdk 37, targetSdk 37, minSdk 24, JDK 17. Sample still pins AppFunctions **alpha10**. | SAMPLE `gradle/libs.versions.toml`, `app/build.gradle.kts` | 2026-10-10 |
| Sample app module does not apply `org.jetbrains.kotlin.android` (AGP 9 built-in Kotlin) and still applies KSP 2.3.10. | SAMPLE | 2026-10-10 |

## AppFunctions: API shape (alpha13)

| Fact | Source | Checked |
|---|---|---|
| alpha13 renamed the `@AppFunction` annotation to **`@AppFunctionDeclaration`** (params: `isEnabled = true`, `isDescribedByKDoc = false`). `AppFunction` is now a *different* thing: an experimental `fun interface` for runtime-registered functions. The overview page, sample and skill still show `@AppFunction`, so they are stale for alpha13. | REL; SRC13 `AppFunctionDeclaration.kt`, `AppFunction.kt` | 2026-10-10 |
| `AppFunctionContext` and `AppFunctionConfiguration` were removed from the public API in alpha12. They remain only as `@RestrictTo(LIBRARY_GROUP)` pending deletion. Functions no longer take a context param. | REL; SRC13 | 2026-10-10 |
| Since alpha10, functions must be declared inside an abstract class extending `AppFunctionService` and annotated `@AppFunctionServiceEntryPoint(serviceName, appFunctionXmlFileName)`. KSP generates a concrete subclass named `serviceName` that implements `onExecuteFunction`, plus `assets/<appFunctionXmlFileName>.xml`. The companion object exposes `FUNCTION_ID_*` constants. | REL alpha10; SRC13 `AppFunctionServiceEntryPoint.kt` | 2026-10-10 |
| The generated service must be declared **manually** in `AndroidManifest.xml`, with permission `android.permission.BIND_APP_FUNCTION_SERVICE`, `exported=true`, properties `android.app.appfunctions.schema=app_functions_schema.xsd` and `android.app.appfunctions.v2=<xmlFileName>.xml`, and intent-filter action `android.app.appfunctions.AppFunctionService`. | SRC13 KDoc; SAMPLE manifest | 2026-10-10 |
| Optional app-level metadata: `<property android:name="android.app.appfunctions.app_metadata" android:resource="@xml/app_metadata"/>` with an `<AppFunctionAppMetadata appfn:description=… appfn:displayDescription=…>` resource. | SAMPLE; SKILL | 2026-10-10 |
| Dependency access without Hilt is supported: read the DI container via `applicationContext` inside the service (service-locator pattern). Hilt is recommended but not required. | SKILL `implementation-configuration.md` | 2026-10-10 |
| `@AppFunctionDeclaration` functions run on the **main thread** by default. Use `suspend` and switch dispatcher for blocking work. Cancellation cancels the coroutine. | SRC13 KDoc | 2026-10-10 |
| Errors: throw subclasses of `AppFunctionException` (e.g. `AppFunctionInvalidArgumentException`, `AppFunctionElementNotFoundException`, `AppFunctionDeniedException`, `AppFunctionAppUnknownException`, `AppFunctionPermissionRequiredException`, `AppFunctionCancelledException`). | SRC13 package listing | 2026-10-10 |
| `@AppFunctionAccessLevel(level, isCompatEnforcementEnabled)` (experimental, alpha13) restricts callers (`ACCESS_LEVEL_SELF`, `ACCESS_LEVEL_SYSTEM`, default `ACCESS_LEVEL_ANDROID_TRUSTED`). The platform enforces it natively from Android 17.2. Before that, Jetpack enforcement is best-effort. | SRC13 `AppFunctionAccessLevel.kt` | 2026-10-10 |
| Runtime registration exists (`registerAppFunction`, `handleAppFunction`, `@AppFunctionSignature`) but it is `@ExperimentalAppFunctionsApi`, `@RequiresApi(CINNAMON_BUN)` (Android 17), and the signature is still compiled into XML at build time. The registration lives only while the registering coroutine/Activity/Service is alive. **It does not remove the build-time schema constraint** and cannot serve cold-start calls. | SRC13 `AppFunctionSignature.kt`, `AppFunctionManager.kt` | 2026-10-10 |

## AppFunctions: serializable types

From SRC13 `AppFunctionSerializable.kt` KDoc (properties of `@AppFunctionSerializable` classes), checked 2026-10-10:

- `Int`, `Long`, `Float`, `Double`, `Boolean`, `String`
- `IntArray`, `LongArray`, `FloatArray`, `DoubleArray`, `BooleanArray`
- `List<String>`
- another `@AppFunctionSerializable` class, or a `List` of one
- proxy types: `android.net.Uri`, `java.time.LocalDate`, `LocalTime`, `LocalDateTime`, `Instant`, `ZoneId`, or a `List` of these (alpha13 changelog: "Support all built-in proxy types" in `AppFunctionData`)
- any `android.os.Parcelable` (no compat guarantees for non-platform parcelables)
- function params/returns additionally allow `PendingIntent` (SAMPLE `makeCall`; SKILL type list)

Rules: properties must be `val`s in the **public primary constructor**. Constructor defaults are **ignored**. A missing value becomes the JVM default for primitives, an empty collection, or `null` for nullables. Other types can't be optional. Per-property descriptions must be inline KDoc on each property, not class-level `@param` (SKILL).

## AppFunctions: modules and aggregation

| Fact | Source | Checked |
|---|---|---|
| `@AppFunctionServiceEntryPoint` + functions can live in an **Android library module**. The sample's `shared` module applies `ksp(appfunctions-compiler)`. The app module also applies `ksp(appfunctions-compiler)` and sets `ksp { arg("appfunctions:aggregateAppFunctions", "true") }`. | SAMPLE `shared/build.gradle.kts`, `app/build.gradle.kts` | 2026-10-10 |
| KSP options recognised by the alpha13 compiler: `appfunctions:aggregateAppFunctions`, `appfunctions:generateMetadataFromSchema`, `appfunctions:appFunctionsXmlLocation`, `appfunctions:generateV1Xml`. | `appfunctions-compiler` alpha13 sources, `AppFunctionCompilerOptions.kt` | 2026-10-10 |
| Missing aggregate flag is a listed cause of "Metadata missing". | SKILL troubleshooting | 2026-10-10 |

## AppFunctions: local testing

| Fact | Source | Checked |
|---|---|---|
| `adb shell cmd app_function help` checks that the service exists. `cmd: Can't find service: app_function` means the device is unsupported. | SKILL `adb-interaction-testing.md` | 2026-10-10 |
| `adb shell cmd app_function list-app-functions` returns JSON. | OVR; SKILL | 2026-10-10 |
| `adb shell cmd app_function execute-app-function --package <pkg> --function '<ServiceClass>#<fn>' --parameters '<json>'` (optional `--brief-yaml`). | SAMPLE README; SKILL | 2026-10-10 |
| `adb shell cmd app_function set-enabled --package <pkg> --function '<id>' --state enable\|disable\|default`. | SKILL | 2026-10-10 |
| In-app harness: `AppFunctionManager.searchAppFunctions` needs **no permission for the caller's own package**. `executeAppFunction` is annotated `@RequiresPermission(EXECUTE_APP_FUNCTIONS, conditional = true)`. | SRC13 `AppFunctionManager.kt` | 2026-10-10 |
| `appfunctions-testing` provides `AppFunctionTestRule` for unit/Robolectric tests. Its KDoc example still shows the pre-alpha10 style. | `appfunctions-testing` alpha13 sources | 2026-10-10 |
| Official "AppFunctions Testing Agent" app lives in SAMPLE `agent/`. It is launched privileged via `./run_privileged.sh`. | SAMPLE README | 2026-10-10 |

## React Native / Expo toolchain

| Fact | Source | Checked |
|---|---|---|
| npm `latest`: `react-native@0.87.1` (2026-08-26), `expo@57.0.27`, `create-expo-module@57.0.1`, `create-react-native-library@0.63.1`. `expo@next` = `58.0.7` (2026-10-09), `create-expo-module@next` = `58.0.2`. | `npm view` | 2026-10-10 |
| RN **0.86.3**: AGP 8.12.0, Kotlin 2.1.20, compileSdk 36. **Incompatible** with AppFunctions alpha10+. | `react-native@0.86` `gradle/libs.versions.toml` | 2026-10-10 |
| RN **0.87.1**: AGP 9.2.1, Kotlin 2.2.0, compileSdk 37, targetSdk 36, minSdk 24. Compatible. | `react-native@0.87.1` `gradle/libs.versions.toml` | 2026-10-10 |
| RN **0.88.0-rc.4**: AGP 9.2.1, Kotlin 2.2.0, compileSdk 37. Compatible. | `react-native@0.88.0-rc.4` | 2026-10-10 |
| Expo SDK 57 = RN 0.86. Expo SDK 58 (`next`, template `expo-template-default@58.0.16`) = RN **0.88.0-rc.4**, React 19.3.0. So **no stable Expo SDK can host AppFunctions today**. | https://expo.dev/changelog/sdk-57; npm template package | 2026-10-10 |
| Expo SDK 57 requires Node ≥ 22.13. | https://docs.expo.dev/versions/latest/ | 2026-10-10 |
| `expo-module-gradle-plugin` (expo-modules-core 57) reads `compileSdkVersion`/`minSdkVersion`/`targetSdkVersion`/`kotlinVersion`/`kspVersion` from root project extras. | `expo-modules-core@57.0.21` sources | 2026-10-10 |
| `create-expo-module`: standalone `npx create-expo-module@latest <name>` generates the module plus an `example` app (runs prebuild). Interactive by default. It is non-interactive when `EXPO_NONINTERACTIVE` is set or stdin is not a TTY, with flags `--name --package --platform --features --description --license --module-version`. `--local` makes an in-app module (no example). | https://docs.expo.dev/more/create-expo-module/ | 2026-10-10 |
| Config plugin for a module: TS source in `plugin/src/index.ts`, `plugin/tsconfig.json` extends `expo-module-scripts/tsconfig.plugin`, root `app.plugin.js` = `module.exports = require('./plugin/build')`. Mods run only during `npx expo prebuild`. | https://docs.expo.dev/modules/config-plugin-and-native-module-tutorial/ | 2026-10-10 |
| Bare RN apps can use Expo modules via `npx install-expo-modules@latest`. The manual instructions target RN 0.86. | https://docs.expo.dev/bare/installing-expo-modules/ | 2026-10-10 |
| `create-react-native-library`: `npx create-react-native-library@latest <name>`, interactive, Turbo Modules / Fabric, Kotlin. Example app options: Community CLI, Expo, React Native Test App. Docs don't mention config plugins. | https://oss.callstack.com/react-native-builder-bob/create | 2026-10-10 |
| KSP plugin id `com.google.devtools.ksp`. Quickstart shows KSP `2.3.10` with Kotlin `2.4.21`, so KSP versions no longer track Kotlin versions 1:1. Output path: `build/generated/ksp/<variant>/kotlin/`. | https://kotlinlang.org/docs/ksp-quickstart.html | 2026-10-10 |

## Headless JS (Android)

| Fact | Source | Checked |
|---|---|---|
| JS: `AppRegistry.registerHeadlessTask('Name', () => require('Name'))`. The task is an async function, and RN pauses when the promise resolves. | https://reactnative.dev/docs/headless-js-android | 2026-10-10 |
| Native: subclass `HeadlessJsTaskService`, override `getTaskConfig(intent)` returning `HeadlessJsTaskConfig(name, Arguments.fromBundle(extras), timeoutMs, allowedInForeground=false[, retryPolicy])`. Declare `<service>` in manifest. Start with `startForegroundService`. | same | 2026-10-10 |
| By default the app **crashes** if the task runs while the app is in the foreground, unless `allowedInForeground = true`. | same | 2026-10-10 |
| No retries by default (`LinearCountingRetryPolicy` + `HeadlessJsTaskError` to opt in). | same | 2026-10-10 |

## Verified by building and running (Phase 1, 2026-10-10)

Source: our own build of `example/` and emulator runs. Logs and commands are in the Phase 1 commit message.

| Fact | Checked |
|---|---|
| RN 0.87.1 example (Gradle 9.4.1, AGP from RN, `android.builtInKotlin=false`) + Kotlin 2.2.0 + KSP `2.3.12` (`classpath com.google.devtools.ksp:symbol-processing-gradle-plugin`) + AppFunctions `1.0.0-alpha13` builds with `assembleDebug`. | 2026-10-10 |
| A **single app module** with the entry point plus `aggregateAppFunctions=true` works; no library module is needed. (Resolves the old open question 2.) | 2026-10-10 |
| KSP output: `build/generated/ksp/<variant>/kotlin/.../FieldAppFunctionService.kt`, `$FieldRecordFactory.kt`, `$Base…_AppFunctionInventory.kt`, `appfunctions_aggregated_deps/*`, and assets `field_app_functions.xml`, `app_functions.xml`, `app_functions_v2.xml`. `app_functions_schema.xsd` comes from the library. | 2026-10-10 |
| **Function ID = `<package>.<BaseClassName>#<function>`**, using the *abstract* class name, not `serviceName`. Example: `io.github.alvinotuya.appfunctions.example.appfunctions.BaseFieldAppFunctionService#listTodaysRecords`. Exposed as the `FUNCTION_ID_LIST_TODAYS_RECORDS` constant. | 2026-10-10 |
| The generated service runs functions on a `SupervisorJob() + Dispatchers.Main` scope created in `onCreate`, so our `withContext(Dispatchers.IO)` is needed. | 2026-10-10 |
| KDoc (`isDescribedByKDoc = true`) flows into the XML and into `list-app-functions` output: function description, `@return`, class KDoc, per-property inline KDoc. | 2026-10-10 |
| The library AAR's manifest merges `<uses-library com.android.extensions.appfunctions required=false>`, the schema property and `AppFunctionCallerVerificationReceiver` into the app. | 2026-10-10 |
| **Android 17 emulator** (`system-images;android-37.0;google_apis;arm64-v8a`, build `CE2A.260420.019`): `cmd app_function` supports `help`, `list-app-functions [--package]`, `execute-app-function … [--timeout-duration <s>] [--brief-yaml] [--pending-intent-path]`, `set-enabled`, `is-enabled`, `purge-allowlist-cache`. Our function lists and executes. | 2026-10-10 |
| `execute-app-function` output is JSON `{"androidAppfunctionsReturnValue": [...]}`, where every scalar is wrapped in a 1-element array. A `LocalDateTime` serializes as an object (`year`, `month`, `dayOfMonth`, `hour`, `minute`, `second`, `nanoOfSecond`). A null property is omitted. | 2026-10-10 |
| Latency (native path, emulator, includes adb overhead): **cold (force-stopped) ≈ 0.7–1.0 s**, warm ≈ 70 ms. | 2026-10-10 |
| **Android 16.0 emulator** (`android-36` google_apis_playstore, build `BE2A.250530.026.D1`, SDK 36.0): the `app_function` service exists, but `cmd app_function` prints "No shell command implementation". `dumpsys app_function` shows only legacy-format (`schemaName`/`schemaCategory`) functions. Our app is **not indexed**; logcat shows `AppSearchAppsUtil: buildAppFunctionMetadataFromPackageInfo: Failed to get property … NameNotFoundException`. | 2026-10-10 |
| Below Android 16 (API 31 emulator): the app installs, launches and keeps running with no crash, so the AppFunctions dependency and service are inert there. | 2026-10-10 |
| SDK package IDs are minor-versioned: `platforms;android-37.0` (not `android-37`). | 2026-10-10 |

## Local machine (2026-10-10)

- JDK 17.0.14. Android SDK platform `android-37.0` and build-tools 37.0.0 installed (2026-10-10). `adb` present.
- AVDs: `AppFunctions_API_37` (Android 17, created 2026-10-10, use this one for AppFunctions), `Pixel_9`/`Pixel_7`/`Pixel_9_Pro` (Android 16.0), `Medium_Phone_API_36.0` (**actually runs API 31** despite its name).
- nvm has Node 22.11.0 and 24.14.1. Repo `.nvmrc` = 24.14.1. The nvm default alias is still 22.11.0, so run `nvm use` in each shell.

## Open questions

1. **Headless JS on the New Architecture / bridgeless.** The RN docs page says nothing about bridgeless/`ReactHost`, or about Android 12+ restrictions on starting foreground services from the background. We'll be starting from inside a bound `AppFunctionService`, not `startForegroundService`. Need to read RN 0.87 `HeadlessJsTaskService`/`HeadlessJsTaskContext` source before Phase 3.
2. ~~Aggregation with a single module~~: resolved, it works (see Phase 1 table).
3. **Generated code location for a library.** The function list is per-consumer-app, so it can't live in our library's own Gradle module (that would mean writing into `node_modules`). Phase 1 showed a single app module works, so the leading option is to generate into an app-module source dir (e.g. `app/build/generated/appfunctions/`) registered by our Gradle script. To decide in Phase 2.
4. **Executing own functions from the harness.** Unverified: whether `executeAppFunction` on our own package succeeds without `EXECUTE_APP_FUNCTIONS` (the annotation says "conditional"). We'll test in Phase 4. `adb` covers us until then.
5. **AGP 9 + Expo modules plugin.** Deferred: Expo was not chosen for the scaffold. Revisit when adding the Expo wrapper.
6. ~~JSON shape of `execute-app-function` output~~: captured (see Phase 1 table).
7. **`AppFunctionTestRule` with the entry-point pattern.** Its KDoc is outdated, and it's unclear whether it supports `@AppFunctionServiceEntryPoint` classes.
8. **Android 16.0 / 16 QPR support (important).** On the Android 16.0 emulator our alpha13 app isn't indexed. That platform build only reads the legacy format, and the docs don't say which platform release introduced the `android.app.appfunctions.v2` property. The compiler has undocumented options `appfunctions:generateV1Xml` and `appfunctions:generateMetadataFromSchema` that may target older indexers. Next steps: try the `android-36.1` emulator image, and ask whether real Android 16 devices with recent updates behave like 36.0 or like 37.
9. **Consumer impact.** The AGP 9.1 / compileSdk 37 floor means consumer apps need RN ≥ 0.87 (or Expo SDK ≥ 58). Check the field-agent app's RN version.
