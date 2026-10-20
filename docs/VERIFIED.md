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
| **Android 16 support needs the v1 index file too.** AOSP AppSearch `service/java/com/android/server/appsearch/appsindexer/AppsUtil.java` (branch `android16-release`, https://android.googlesource.com/platform/packages/modules/AppSearch/) reads service property `android.app.appfunctions.v2` only when the package defines a dynamic schema; otherwise it reads `android.app.appfunctions` (the v1 XML). On `main` only `android.app.appfunctions` is read in that path. | 2026-10-10 |
| KSP option `appfunctions:generateV1Xml=true` makes the compiler also write `assets/<appFunctionXmlFileName>-v1.xml`, the legacy v1 index (`AppFunctionLegacySchemaXmlGenerator`, alpha13 compiler sources). The file holds only `function_id` + `enabled_by_default`, with no descriptions or parameter schema. | 2026-10-10 |
| With `generateV1Xml` + a service `<property android:name="android.app.appfunctions" android:value="field_app_functions-v1.xml"/>` alongside the v2 property: **Android 16.0** (`BE2A.250530.026.D1`) indexes the function (seen in `dumpsys app_function`; no `cmd` tool there, so execution is unverified). **Android 16 QPR / 36.1** (`BE4B.251210.005`, AVD `AppFunctions_API_36_1`) lists the full v2 metadata with descriptions and executes cold. **Android 17** is unchanged (lists with descriptions, executes cold). | 2026-10-10 |
| On 36.1, `list-app-functions` does **not** accept `--package`; filter the JSON yourself. | 2026-10-10 |
| AGP Variant API (9.2.1 `gradle-api` sources): `variant.sources.{java,kotlin,res,assets}.addGeneratedSourceDirectory(taskProvider, wiredWith)` and `variant.sources.manifests.addGeneratedManifestFile(taskProvider, wiredWith)`. Generated manifests are merged at the highest priority. | 2026-10-10 |
| **Spike:** with RN 0.87.1 (`android.builtInKotlin=false`, `kotlin-android` plugin) + KSP 2.3.12, Kotlin added via `variant.sources.kotlin.addGeneratedSourceDirectory` **compiles but is not processed by KSP**: no service class and no XML. Adding the task output to the Kotlin source set (`kotlin.sourceSets.main.kotlin.srcDir(task.flatMap { it.outputDir })`) **is** processed by KSP. Gradle infers the task ordering from the provider. | 2026-10-10 |
| `addGeneratedManifestFile` **overrides** the task's manifest file location with its own: `build/generated/manifests/<taskName>/AndroidManifest.xml`. A value set beforehand is ignored. | 2026-10-10 |
| Phase 2 end to end: the example built only from `appfunctions.config.ts` via `android/appfunctions.gradle` lists (7 descriptions) and executes cold on Android 17 and 16 QPR, is indexed on 16.0, and launches with no crash on API 31. | 2026-10-10 |
| SDK package IDs are minor-versioned: `platforms;android-37.0` (not `android-37`). | 2026-10-10 |

## Headless JS internals (RN 0.87.1 source, `node_modules/react-native/ReactAndroid/.../jstasks/`, `HeadlessJsTaskService.kt`, `Libraries/ReactNative/AppRegistryImpl.js`)

| Fact | Checked |
|---|---|
| Bridgeless is supported: when `enableBridgelessArchitecture()`, `HeadlessJsTaskService` uses `(application as ReactApplication).reactHost`. If `currentReactContext` is null it calls `reactHost.start()` and waits for `ReactInstanceEventListener.onReactContextInitialized`, then calls `HeadlessJsTaskContext.getInstance(ctx).startTask(config)`. | 2026-10-10 |
| `HeadlessJsTaskContext.startTask` must run on the UI thread. It **throws** if the context's lifecycle is `RESUMED` and `isAllowedInForeground` is false. It returns an int task id. Listeners (`HeadlessJsTaskEventListener`) get `onHeadlessJsTaskStart/Finish(taskId)`. | 2026-10-10 |
| `HeadlessJsTaskConfig(taskKey, data: WritableMap, timeout: Long = 0, isAllowedInForeground = false, retryPolicy)`. The timeout only calls `finishTask` (it doesn't stop JS). | 2026-10-10 |
| JS side `startHeadlessTask(taskId, taskKey, data)`: an unknown key → `console.warn` + `notifyTaskFinished` immediately. The task promise resolving → `notifyTaskFinished`. A rejection → `console.error` (red box in dev). **No result value is passed back to native**, so results need their own native-module call. | 2026-10-10 |
| `HeadlessJsTaskService` is a *started* service (`startForegroundService` in the docs, which is subject to Android 12+ background-start limits). We are inside a *bound* `AppFunctionService`, so we can drive `ReactHost` + `HeadlessJsTaskContext` directly without starting another service. | 2026-10-10 |

## Phase 3 results (our builds, 2026-10-10)

| Fact | Checked |
|---|---|
| JS path end to end (release APK, bundle embedded) on Android 17 and 16 QPR emulators: cold success, `AppFunctionError('NOT_FOUND')` → platform code 1500, invalid return value → code 3000 with the field path, timeout → code 3000 after about 10.1 s, call while the app is in the foreground → success with no crash. | 2026-10-10 |
| Cold calls really start a new process (`pidof` empty before; logcat `Start proc …for bound-service`), and `BridgelessReact` creates the instance and loads the bundle. | 2026-10-10 |
| Latency (emulator on an Apple Silicon host, includes adb, 5 runs): Android 17 native cold 90–148 ms / warm 51–79 ms; JS cold 96–270 ms / warm 49–71 ms. Android 16 QPR: native cold 100–179 ms, JS cold 112–176 ms. **Real devices will be slower; needs re-measuring on hardware.** | 2026-10-10 |
| Debug build, cold, Metro not running: the JS function times out (no bundle); native functions keep working. | 2026-10-10 |
| `suspendCancellableCoroutine` inside `withTimeoutOrNull` needs an explicit type argument (`<JsBridge.Result>`), or Kotlin infers `Nothing?`. | 2026-10-10 |
| Derived TS handler types reject wrong return field types, unknown argument names and unknown function names (probe compiled with `tsc`). | 2026-10-10 |

## Google's AppFunctions Testing Agent (SAMPLE `agent/`, 2026-10-10)

| Fact | Checked |
|---|---|
| It builds with `./gradlew :app:assembleStandardDebug` (AGP 9.3.2, appfunctions alpha11) and lists and executes our example's `findRecord` and `listTodaysRecords` on the Android 17 emulator. | 2026-10-10 |
| `run_privileged.sh` / `startAppFunctionTestingAgent` fail on the Android 17 emulator: they take the "fingerprint" from `dumpsys package … PackageSignatures` (a 7-char hash), but `cmd allowlist` needs the SHA-256 certificate digest. Workaround: `apksigner verify --print-certs <apk>` → `adb shell cmd allowlist add-package-with-metadata-multimap 2 com.example.appfunctions.agent:<sha256> android.allowlist.metadata.key.APP_FUNCTION_TYPE_DOWNLOADED:boolean:true "'*'" ignore:string:default`, then `cmd app_function flush-allowlist-changes` and `am instrument -w com.example.appfunctions.agent/.ShellIdentityInstrumentation`. | 2026-10-10 |

## Consumer validation (packed tarball, 2026-10-10)

| Fact | Checked |
|---|---|
| Fresh `@react-native-community/cli init --version 0.87.1 --pm npm` app + `npm install react-native-app-functions-0.1.0.tgz` (45 files, 28.8 kB), set up by following README steps only: the debug and release builds succeed. The codegen runs from `node_modules`, and `typescript` resolves from the package's dependency. No warnings from the library. | 2026-10-10 |
| In the consumer app, `tsc --noEmit` passes with the handler types from the published `lib/typescript` (`react-native-app-functions/config` export); a wrong return type is rejected. | 2026-10-10 |
| Android 17 emulator, consumer release APK: both functions listed (7 descriptions). Cold native `listTodaysVisits`, cold JS `getVisit` and JS `NOT_FOUND` (code 1500) all behave as in the example app. | 2026-10-10 |

## `AppFunctionManager(Compat)` history and SDK gates (published `-sources.jar`s, 2026-10-11)

| Fact | Checked |
|---|---|
| alpha01–07 name the Jetpack client `AppFunctionManagerCompat`; alpha08 renamed it `AppFunctionManager` (`androidx.appfunctions`). | 2026-10-11 |
| alpha01 `getInstance`: non-null when `SDK_INT >= TIRAMISU` (33) **and** the extension library is present. alpha05: `>= BAKLAVA` (36) → platform API; `>= UPSIDE_DOWN_CAKE` (34) + extension library → extension API. Tiramisu dropped. | 2026-10-11 |
| alpha13 `getInstance`: null below API 34 and for profile users. `>= CINNAMON_BUN` (37) → `PlatformAppFunctionReader` + platform API; `>= BAKLAVA` (36) → `AppSearchAppFunctionReader` + platform API; extension library available (34–35) → AppSearch reader + `ExtensionAppFunctionManagerApi`. | 2026-10-11 |
| Implications: our generated service (`AppFunctionService`, `@RequiresApi(36)`) does **not** serve Android 14–15 extension-library devices (those use `ExtensionsAppFunctionService`, alpha11+). A future `isSupported()` must check `SDK_INT >= 36`, not only `getInstance() != null`. Which devices ship the extension library is undocumented. | 2026-10-11 |

## Notes demo (`examples/notes`, 2026-10-11)

| Fact | Checked |
|---|---|
| Fresh RN 0.87.1 app + `react-native-app-functions@alpha` **from npm** + `react-native-mmkv` 4.3.2 + `react-native-nitro-modules` 0.37.1: the release build succeeds (MMKV 4 / Nitro work on RN 0.87). | 2026-10-11 |
| Foldable AVD `AppFunctions_Fold_API_37` (pixel_9_pro_fold, android-37.0 google_apis): unfolded 2076×2152 @390 dpi, two displays (screencap/screenrecord need `-d <id>`). `FLAG_ACTIVITY_LAUNCH_ADJACENT` via `am start -f 0x10001000` did **not** produce split screen. | 2026-10-11 |
| All four JS functions work via `cmd app_function`; a call while the app is open updates the UI live (the store is shared with the headless task's runtime); a cold `createNote` persists through MMKV and shows when the app is opened. | 2026-10-11 |
| The fold AVD was created with `hw.gpu.enabled=no` and `hw.ramSize=2G` (software rendering), which lagged badly. Fixed with `hw.gpu.enabled=yes`, `hw.gpu.mode=host`, `hw.ramSize=4096` and `hw.cpu.ncore=6` (host: M3 Pro, 18 GB). The emulator warns that API 37 wants GLES 3.1 while the host translator gives 3.0, but it rendered correctly. A hardware keyboard (`hw.keyboard=yes`) made Gboard show floating toolbars; fixed by `settings put secure stylus_handwriting_enabled 0` and `pm disable-user --user 0 com.google.android.inputmethod.latin` (plain `ime disable` gets undone by the system). | 2026-10-11 |
| On this fold image `cmd allowlist` lacks `add-package-with-metadata-multimap`; `add-package-multimap 2 <pkg>:<sha256> "'*'"` works (Google's script checks `help` and falls back). | 2026-10-11 |
| `EXECUTE_APP_FUNCTIONS` is `prot=internal|privileged`; the shell (`com.android.shell`) holds it. `cmd app_function` runs as the shell. The Testing Agent gets it via `UiAutomation.adoptShellPermissionIdentity` inside `ShellIdentityInstrumentation` (it must be started with `am instrument -w`) plus the Android 17 caller allowlist. The agent's LLM mode offers Gemini all enabled functions from all connected apps (`AgentOrchestrator.filterTools`); the standard flavor takes the Gemini key in Settings. | 2026-10-11 |

## iOS: `expo-app-intents` (https://docs.expo.dev/versions/latest/sdk/app-intents/, npm 0.5.10, 2026-10-20)

| Fact | Checked |
|---|---|
| **Alpha** ("will frequently experience breaking changes"). Docs are for Expo SDK 58. Runtime: iOS 16.4+. Some features need iOS 18 / 18.4 / 27 and Xcode 27. Not in Expo Go. | 2026-10-20 |
| Setup: config plugin `expo-app-intents` + inline modules (`watchedDirectories: ["app-intents"]`), `npx expo-app-intents init`, `npx expo prebuild -p ios`. Bare RN (no prebuild) is **not documented**. | 2026-10-20 |
| Intents are **hand-written Swift** in the `app-intents/` folder, compiled at build time (Xcode metadata extraction). JS cannot define intents or Siri phrases at runtime. | 2026-10-20 |
| `perform()` runs in Swift and calls `AppIntentDispatcher.shared.dispatch(name:params:)`: persisted, **at-least-once**, **one-way** to JS (`useAppIntents` / `onIntent`); **no return value from JS to Siri**. Pending queue max 100. | 2026-10-20 |
| Read-style data for the system comes from JS-published **entity catalogs** (`setEntityCatalogAsync`, stored in `UserDefaults`, keep small) queried from Swift. | 2026-10-20 |
| App Shortcuts: static phrases, each must include `\(.applicationName)`, max 10 shortcuts, at most one non-array parameter per phrase. | 2026-10-20 |
| npm: `expo-app-intents@0.5.10`, peer `expo`/`react`/`react-native` `*`, depends on `@expo/ui ^58`. `expo@latest` = 58.0.16. | 2026-10-20 |
| Local: Xcode 27.0 (27A266a), iOS simulator runtimes 26.5 / 27.0 / 27.1, CocoaPods installed. | 2026-10-20 |

## iOS: Apple App Intents (developer.apple.com docs via `/tutorials/data/documentation/appintents/*.json`, and the Xcode 27 SDK `AppIntents.swiftmodule/arm64-apple-ios-simulator.swiftinterface`, 2026-10-20)

| Fact | Checked |
|---|---|
| `AppIntent` (iOS 16+) "make[s] your app's actions discoverable by Apple Intelligence and Siri, the Shortcuts app, and other system experiences". It can be implemented "in your app, app extension, framework, or Swift package". Inputs use `@Parameter`; `perform()` returns a result to the system. | 2026-10-20 |
| `AppIntentsPackage` (iOS 17+) is required to expose intents declared in a framework/package; by default intents are part of the app bundle. | 2026-10-20 |
| `openAppWhenRun` is deprecated in iOS 26 → `supportedModes: IntentModes` (iOS 26+): `.background`, `.foreground(.immediate / .deferred / .dynamic)`. | 2026-10-20 |
| `ReturnsValue<Value>` (iOS 16+). Value types (`_IntentValue`): `String`, `Int`, `Double`, `Bool`, `Date`, `DateComponents`, `URL`, `Measurement`, `AttributedString`, `IntentFile`, `Optional`, `Array`/`Set` of values, entities. | 2026-10-20 |
| `TransientAppEntity` (iOS 16+): an `AppEntity` with `init()` and a built-in UUID id/default query, suited to returning structured values without a database query. | 2026-10-20 |
| RN 0.87 `min_ios_version_supported` = `15.1` (`scripts/cocoapods/helpers.rb`), so generated intents need `@available(iOS 16.0, *)`. The RN 0.87 template `AppDelegate.swift` calls `factory.startReactNative(…)` inside `didFinishLaunchingWithOptions` (unverified: whether that also runs on a background launch for an intent). | 2026-10-20 |

## iOS slice 1 results (example app, 2026-10-20)

| Fact | Checked |
|---|---|
| A hand-written `AppIntent` + `TransientAppEntity` (`@Property(title:)` + `init()`) + native Swift handler compiles in the RN 0.87.1 app target (Swift 5, deployment target 15.1). Every App Intents type, including the `CustomLocalizedStringResourceConvertible` error, needs `@available(iOS 16.0, *)`. | 2026-10-20 |
| Xcode runs `ExtractAppIntentsMetadata` for the app target; the `.app` contains `Metadata.appintents/extract.actionsdata` listing `ListTodaysRecordsIntent` (title, description, output `[FieldRecordEntity]`) and the entity's properties. | 2026-10-20 |
| Adding a file to the RN template's app group needs a path relative to the group's real path (`AppFunctionsExample/<file>`); the group itself has no path. Done with the `xcodeproj` gem (idempotent script), which is what the Podfile helper will use. | 2026-10-20 |
| **iOS 27 simulator:** the RN 0.87.1 template app **fails to launch**: `Application failed to launch: UIScene life cycle is r[equired]` (`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`). iOS 26.5 launches fine. Not a library issue, but iOS 27 testing needs the app to adopt `UIScene`. | 2026-10-20 |
| iOS 26.5 foreground launch: `didFinishLaunching` runs with `applicationState=1`, and RN posts `RCTInstanceDidLoadBundle` ~238 ms later (Release, embedded bundle). **Background launch via an intent (app terminated, run from Shortcuts):** `applicationState=2` (background), the JS bundle loaded ~120 ms in, and the native handler ran. So RN starts and loads JS on an intent's background launch, and the JS bridge is viable. | 2026-10-20 |
| Local tooling: `Simulator.app` is not present in this Xcode 27 install (simulators run headless via `simctl`). The `pod` launcher in RVM ruby-3.1.4 fails with `GemNotFoundException` even though `cocoapods 1.16.2` is installed; the workaround is `ruby -e 'load Gem.bin_path("cocoapods","pod")' install` with `~/.rvm/environments/default` sourced. | 2026-10-20 |

| Shortcuts (iOS 26.5 simulator) lists the app under its actions, finds "List Todays Records" by search, and running it cold shows the 3 records using the entity's `DisplayRepresentation` (title + status subtitle), without bringing the app to the foreground. | 2026-10-20 |
| Automation: an XCUITest target can drive `XCUIApplication(bundleIdentifier: "com.apple.shortcuts")` (Create Shortcut → focus "Search Actions" (the first tap only expands the sheet) → type → tap the cell → `play`). Action **results are not in Shortcuts' accessibility tree**, so values are verified via screenshots/logs; the test asserts no error alert. `DeviceHub.app` (Xcode 27) shows the simulator UI. | 2026-10-20 |

## iOS slice 2 results (codegen + Podfile helper, 2026-10-20)

| Fact | Checked |
|---|---|
| SDK (Xcode 27 `AppIntents.swiftinterface`): `IntentParameter` has `init(title: LocalizedStringResource, description: LocalizedStringResource? = nil, …)` for any `Value.ValueType: _IntentValueRepresentable`. `String`, `Int`, `Double`, `Bool`, `Date`, `Optional` and `Array` conform to `_IntentValue`. `TransientAppEntity` gets a built-in `defaultQuery` (`_TransientAppEntityQuery`). | 2026-10-20 |
| Generated Swift for a wide config (every scalar, nullable/list params and returns, nested/optional/list entities, Swift-keyword names, a param named `title`/`description` next to the static intent `title`/`description`) type-checks with `swiftc -typecheck -target arm64-apple-ios16.0-simulator` (Swift 5) with no warnings. Only the example's shapes have been through a full Xcode build and App Intents metadata extraction. | 2026-10-20 |
| `appfunctions_post_install` in the example Podfile: `pod install` generates the file, adds the file reference + Compile Sources entry and the Run Script phase before Sources; a second `pod install` leaves `project.pbxproj` byte-identical. | 2026-10-20 |
| With the generated file deleted, a Release `xcodebuild` for the iOS 26.5 simulator recreates it in the Run Script phase and succeeds. `Metadata.appintents` lists `ListTodaysRecordsIntent` returning `[FieldRecordEntity]`. The Shortcuts XCUITest passes (29 s) and shows the 3 records with status subtitles, same as the hand-written slice. | 2026-10-20 |

## Local machine (2026-10-10)

- JDK 17.0.14. Android SDK platform `android-37.0` and build-tools 37.0.0 installed (2026-10-10). `adb` present.
- AVDs: `AppFunctions_Fold_API_37` (Pixel 9 Pro Fold, Android 17, created 2026-10-11; the earlier `AppFunctions_API_37` / `AppFunctions_API_36_1` and the 36.1 image were deleted to free space); `Pixel_9`/`Pixel_7`/`Pixel_9_Pro` (Android 16.0), `Medium_Phone_API_36.0` (**actually runs API 31** despite its name).
- nvm has Node 22.11.0 and 24.14.1. Repo `.nvmrc` = 24.14.1. The nvm default alias is still 22.11.0, so run `nvm use` in each shell.

## Open questions

1. ~~Headless JS on bridgeless~~: resolved from the RN 0.87.1 source, and works on device (see Phase 3 results).
2. ~~Aggregation with a single module~~: resolved, it works (see Phase 1 table).
3. **Generated code location for a library.** The function list is per-consumer-app, so it can't live in our library's own Gradle module (that would mean writing into `node_modules`). Phase 1 showed a single app module works, so the leading option is to generate into an app-module source dir (e.g. `app/build/generated/appfunctions/`) registered by our Gradle script. To decide in Phase 2.
4. **Executing own functions from the harness.** Unverified: whether `executeAppFunction` on our own package succeeds without `EXECUTE_APP_FUNCTIONS` (the annotation says "conditional"). We'll test in Phase 4. `adb` covers us until then.
5. **AGP 9 + Expo modules plugin.** Deferred: Expo was not chosen for the scaffold. Revisit when adding the Expo wrapper.
6. ~~JSON shape of `execute-app-function` output~~: captured (see Phase 1 table).
7. **`AppFunctionTestRule` with the entry-point pattern.** Its KDoc is outdated, and it's unclear whether it supports `@AppFunctionServiceEntryPoint` classes.
8. **Android 16.0 execution.** It's now indexed via the v1 file (see table), but there's no `cmd app_function` on 16.0, so execution there is unverified. The v1 index also has no descriptions or parameter schema, so it's unclear what an agent on 16.0 sees. Next: verify with the in-app harness (Phase 4) or a real device. `generateV1Xml` and the v1 property are not in the official docs; we rely on the AOSP and compiler source.
9. **Consumer impact.** The AGP 9.1 / compileSdk 37 floor means consumer apps need RN ≥ 0.87 (or Expo SDK ≥ 58). Check the field-agent app's RN version.
10. **The `NO_RESULT` path** (task finishes without a result, for example when no handler is registered) is implemented but not exercised on a device yet.
11. **Generated Kotlin for every type shape** is snapshot-tested but only the example's shapes are compiled. Add a compile check (a richer example config or a test module) before relying on lists of instants and nested nullable types.
12. **Real-device latency** for cold JS calls (the emulator numbers are a lower bound).
