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
    src/templates/             ALL Kotlin/XML templates (alpha upgrades touch only this + versions.json)
  versions.json                single pin: AppFunctions + KSP versions (read by Gradle and the example)
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
4. Manifest: `<service>` for the generated `FieldAppFunctionService` (permission, exported, `schema` + `v2` + legacy `android.app.appfunctions` (v1) properties, intent-filter, `tools:targetApi="36"`), plus the `app_metadata` property and `res/xml/app_metadata.xml`. KSP arg `appfunctions:generateV1Xml=true` produces the v1 file Android 16 needs.
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

**Phase 2: codegen reproduces Phase 1.** Detailed plan in section 6.

## 6. Phase 2 detailed plan (approved and implemented 2026-10-10)

### 6.1 Config (public API, needs approval)

`example/appfunctions.config.ts`, imported from a `react-native-app-functions/config` subpath so the RN runtime bundle never pulls in codegen:

```ts
import { defineAppFunctions } from 'react-native-app-functions/config';

export default defineAppFunctions({
  android: {
    kotlinPackage: 'io.github.alvinotuya.appfunctions.example.appfunctions',
    serviceName: 'FieldAppFunctionService',        // generated: Base<serviceName> + <serviceName>
    appDescription: 'Field-agent app holding …',   // → app_metadata.xml
    appDisplayDescription: "Lets assistants read today's field records",
  },
  types: {
    FieldRecord: {
      description: 'A field record scheduled for the current day.',
      fields: {
        id:          { type: 'string', description: 'The unique identifier of the record.' },
        title:       { type: 'string', description: '…' },
        status:      { type: 'string', description: '…' },
        scheduledAt: { type: 'localDateTime', nullable: true, description: '…' },
      },
    },
  },
  functions: {
    listTodaysRecords: {
      description: 'Lists the field records scheduled for today …',
      handler: 'native',
      params: {},
      returns: { type: 'list', of: 'FieldRecord', description: "Today's field records. …" },
    },
  },
});
```

- `defineAppFunctions` is an identity function that gives editor types. The codegen **never executes** the file: it parses it with the TypeScript compiler API and accepts only literals (object, string, boolean, array). Anything else (variables, calls, spreads, template expressions) fails the build with the file:line.
- v0 type vocabulary: `string`, `int`, `long`, `double`, `boolean`, `localDateTime`, `instant`, `localDate`, a named type from `types`, and `{ type: 'list', of: <any of those> }`. Every field can be `nullable`. Anything else fails the build with `function "<fn>", field "<path>": <reason>`. More types come later (`VERIFIED.md` lists what AppFunctions supports).

### 6.2 What gets generated (into `app/build/generated/appfunctions/`)

> **As implemented:** Kotlin is wired through the Kotlin `main` source set, not the Variant API, because KSP ignores Variant API sources (see 6.6 step 1 and DECISIONS.md). Each declared type gets its own `<TypeName>.kt`, resources are named `appfunctions_*`, and JS functions add `AppFunctionsJson.kt` (section 7). The table below is the original proposal.

| Output | Content | Wired via (AGP 9.2.1 Variant API, verified in source) |
|---|---|---|
| `kotlin/.../Base<Service>.kt` | `@AppFunctionServiceEntryPoint` abstract service. One `@AppFunctionDeclaration(isDescribedByKDoc = true)` per function, with KDoc from config, running on `Dispatchers.IO` and calling the handler. | `sources.kotlin.addGeneratedSourceDirectory` |
| `kotlin/.../Types.kt` | `@AppFunctionSerializable(isDescribedByKDoc = true)` data classes with inline KDoc | same |
| `kotlin/.../Handlers.kt` | `fun interface <Fn>Handler` per native function, plus an `AppFunctionsHandlers` interface the app's `Application` implements | same |
| `AndroidManifest.xml` | the `<service>` (v2 **and** v1 properties) + the `app_metadata` property | `sources.manifests.addGeneratedManifestFile` |
| `res/xml/app_metadata.xml`, `res/values/appfunctions_strings.xml` | app-level description | `sources.res.addGeneratedSourceDirectory` |

The function ID stays `<kotlinPackage>.Base<serviceName>#<function>`, matching Phase 1. The app keeps only its own code: the handler implementation and `MainApplication implements AppFunctionsHandlers`.

### 6.3 Build integration (bare RN first)

- The library ships `android/appfunctions.gradle`. A consumer app adds one line to `app/build.gradle`: `apply from: "../../node_modules/react-native-app-functions/android/appfunctions.gradle"`. This is the same pattern as react-native-vector-icons' `fonts.gradle`.
- The script:
  - adds `appfunctions` + `ksp(appfunctions-compiler)` and the KSP args `aggregateAppFunctions` + `generateV1Xml`;
  - registers one `generateAppFunctions` task (as implemented; proposed per variant) that runs `node <lib>/codegen/lib/cli.js --config <appRoot>/appfunctions.config.ts --out <dir>`), with the config file as a declared input so Gradle reruns it only on change;
  - wires the outputs in with the Variant API above, so ordering before KSP comes from the task graph instead of hand-written `dependsOn`.
- The consumer still applies the KSP Gradle plugin itself, because a script plugin can't add buildscript classpath entries. The README will say so.
- **One version pin:** `versions.json` at the library root (`appfunctions`, `ksp`). Gradle reads it with `JsonSlurper`, and the Node side imports it.

### 6.4 Codegen package layout

```
codegen/
  src/cli.ts            args → parse → validate → render → write (only rewrites files whose content changed)
  src/parse.ts          TS compiler API, literal-only extraction
  src/model.ts          validated IR
  src/validate.ts       type mapping + loud errors
  src/render.ts         IR → files
  src/templates/        all Kotlin/XML templates (alpha upgrades touch only here + versions.json)
  __fixtures__/handwritten/   Phase 1 files moved here (diff target)
  __tests__/            parse, validate, render (render == fixture), CLI end to end
  tsconfig.json         compiled with tsc to codegen/lib (no runtime TS loader needed)
src/config.ts           defineAppFunctions + config types (the `./config` export)
```

### 6.5 Dependencies (needs approval)

- `typescript`: move from devDependencies to **dependencies** (already approved).
- **New:** `jest` + `@types/jest` as root devDependencies for the codegen tests. The scaffold only put a Jest preset in `example/`. Tests run through the existing Babel config, so no `ts-jest`.

### 6.6 Steps

1. **Spike first:** confirm KSP processes Kotlin added via `sources.kotlin.addGeneratedSourceDirectory`. **Result: it doesn't.** We use `kotlin.sourceSets.main.kotlin.srcDir(task.flatMap { … })` instead (see DECISIONS.md).
2. Move Phase 1 files into `codegen/__fixtures__/handwritten/`.
3. Parser + validator + tests (including error-message tests).
4. Templates + renderer: the render test asserts generated == fixture, modulo the `// GENERATED — do not edit` header.
5. CLI + `appfunctions.gradle` + `versions.json`. Switch the example to `apply from`, then delete the hand-written Kotlin, manifest service block and `app_metadata.xml` from `example/`.
6. Verify: clean build, APK contains both XMLs, Android 17 and 36.1 list + cold execute, and API 31 launches.

### 6.7 Done when

- The example has no hand-written AppFunctions code except its handler and `MainApplication`, and verification step 6 passes.
- Unsupported config fails the build with a message naming the function and field.
- `yarn test` passes, and the render test proves the generator reproduces Phase 1.

**Phase 3: `handler: "js"` via Headless JS.** *(Original summary; superseded by the implemented design in section 7.)*
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

## 7. Phase 3 detailed plan: `handler: "js"` (approved and implemented 2026-10-10)

Facts behind this plan are in `VERIFIED.md` under "Headless JS internals".

### 7.1 How a JS call flows

```
agent → FieldAppFunctionService (KSP) → Base…Service.findRecord(id)          [generated]
      → JsBridge.call(context, "findRecord", argsJson, timeoutMs)            [library, Kotlin]
          1. callId = UUID; a pending callback registered under callId (as implemented; generated code
             awaits it with suspendCancellableCoroutine + withTimeoutOrNull)
          2. on the main thread: reactHost.currentReactContext ?: reactHost.start() + wait
          3. HeadlessJsTaskContext.startTask(HeadlessJsTaskConfig(
               "ReactNativeAppFunctions", {callId, name, argsJson}, timeout, allowedInForeground = true))
          4. withTimeout(timeoutMs) { deferred.await() }
      → JS: headless task "ReactNativeAppFunctions" (registered by the library on import)
          looks up the handler from registerAppFunctionHandler(name, fn), awaits it, then calls
          NativeAppFunctions.completeCall(callId, JSON.stringify(result))
          or NativeAppFunctions.failCall(callId, code, message). The task itself never rejects.
      → JsBridge resolves the deferred → generated code decodes JSON → typed Kotlin result
```

- **Why not `HeadlessJsTaskService`:** it's a started service, launched with `startForegroundService` from the background. We're already inside a bound service that keeps the process alive, so we use the same `ReactHost` / `HeadlessJsTaskContext` calls it makes internally.
- **Fail fast:** if the task finishes (`onHeadlessJsTaskFinish`) without `completeCall`/`failCall`, for example because no handler is registered, the call fails immediately with a message telling the app to call `registerAppFunctionHandler` in `index.js`. It doesn't wait for the timeout.
- **The library module stays free of the alpha dependency.** `JsBridge` returns a plain result (`Success(json)` / `Failure(code, message)`). The *generated* code, which already depends on `androidx.appfunctions`, maps it to AppFunction exceptions.

### 7.2 Public API (needs approval)

```ts
// index.js, top level, before AppRegistry.registerComponent (it must run on a headless start too)
import { registerAppFunctionHandler, AppFunctionError } from 'react-native-app-functions';
import type config from './appfunctions.config';

registerAppFunctionHandler<typeof config, 'findRecord'>('findRecord', async ({ id }) => {
  const row = await db.getRecord(id);
  if (!row) throw new AppFunctionError('NOT_FOUND', `No record ${id}`);
  return { id: row.id, title: row.title, status: row.status, scheduledAt: row.scheduledAt };
});
```

- **Typed args and return values with no extra codegen:** `defineAppFunctions` already keeps the literal type (`const T`), so the TS types for each handler are derived at the type level from `typeof config`. The JS bundle never imports the config, because `import type` is erased.
- **Wire format** (JSON):

  | Type | JSON |
  |---|---|
  | `string`, `boolean` | as is |
  | `int`, `long`, `double` | number (`long` above 2^53 loses precision, which will be documented) |
  | `localDate` | `"2026-10-10"` |
  | `localDateTime` | `"2026-10-10T08:30"` |
  | `instant` | `"2026-10-10T08:30:00Z"` (ISO-8601) |
  | nullable | `null` |
  | list | array |
  | declared type | object |

- **`AppFunctionError(code, message)`**, with code one of `INVALID_ARGUMENT | NOT_FOUND | DENIED | PERMISSION_REQUIRED | LIMIT_EXCEEDED | ALREADY_EXISTS`. These map to the matching `AppFunction*Exception`. Any other thrown error, an invalid return value, or a timeout becomes `AppFunctionAppUnknownException` with a message.
- **Config additions:** `handler: 'js'` and an optional per-function `timeoutMs`, default 10 000.
  - The `cmd` tool waits 30 s by default; the real agent's budget is undocumented.
  - The default is a guess to tune after measuring.
- **The scaffold's `multiply`** in `src/` and the Turbo Module are replaced by `completeCall` / `failCall`.

### 7.3 What the codegen adds (only when a config has `js` functions)

- The `js` declarations call `JsBridge` instead of a handler.
- A generated `AppFunctionsJson.kt` with `toJson` / `fromJson` for every type that `js` functions use, built on Android's built-in `org.json` (no new dependency). It validates strictly; for example, `"findRecord" returned an invalid value: field "status" is missing` becomes `AppFunctionAppUnknownException`.
- `js` functions get no `…Handler` interface.
- Native-only configs (like the Phase 1/2 reference) generate exactly what they do today, so the existing fixture test still holds.

### 7.4 Steps

1. Library runtime: `JsBridge.kt`, the Turbo Module (`completeCall`, `failCall`), and the JS side (`registerAppFunctionHandler`, `AppFunctionError`, the headless task, handler types).
2. Write the expected Kotlin for one JS function by hand as a new fixture (`__fixtures__/handwritten-js/`): the example config plus `findRecord(id): FieldRecord?`, with `listTodaysRecords` staying native.
   - **Deviation from the "hand-write in the app first" rule:** the generator now owns the service file, so hand-writing it into the app means fighting the generator. Instead the hand-written fixture is the target, and device verification happens right after step 3.
3. Codegen: `handler: 'js'`, `timeoutMs`, and the JSON codec templates. The render test asserts output == hand-written fixture. Add type-mapping and validation tests.
4. Example app: the `findRecord` JS handler in `index.js` over the same dummy data.
5. Verify on the Android 17 and 16 QPR emulators:
   - success, not-found (`AppFunctionError`), a bad return value, and the timeout;
   - app in the foreground (no crash);
   - **cold-start latency of the JS path** in a release build (bundle embedded), compared with native, over 5 runs each after `am force-stop`;
   - the debug build with Metro, noting that a killed debug app needs Metro running.
6. Docs: README (JS handlers, `index.js` placement, wire format, timeouts), VERIFIED, DECISIONS.

### 7.5 Risks

- **Cold-start JS latency** could be several seconds (process start + Hermes + bundle load). If it's too slow for agents, mitigations are keeping handlers in a small separate entry, or recommending `native` for hot paths. We'll measure first.
- **Foreground interplay:** the handler shares the JS thread with the UI. Long handlers would jank the UI, so this needs documenting.
- **Debug builds** need Metro to load the bundle on a cold start.

## 8. Showcase: notes demo app (approved 2026-10-11; steps 1–4 and 7 done)

Goal: a polished notes app whose functions Gemini calls live, recorded side by side with Google's AppFunctions Testing Agent ("Agent Demo" tab, Gemini) on an unfolded foldable. It's also a public reference app that installs `react-native-app-functions@alpha` **from npm**.

### 8.1 Where and how

- `examples/notes/`: a fresh bare RN 0.87.1 app (`@react-native-community/cli init`, npm), **outside** the yarn workspace (the root `workspaces` stays `["example"]`), so it installs the library from the registry exactly as a user would. Root tsconfig, ESLint and tsconfig.build exclude `examples/`. `example/` stays the library's dev and test app.
- Package id `io.github.alvinotuya.notes`, app name "Notes".

### 8.2 Functions (all `handler: 'js'`, so agent writes show up live in the open UI)

| Function | Params | Returns | Description for the LLM (summary) |
|---|---|---|---|
| `createNote` | `title`, `body`, `tags?: list<string>` | `Note` | Create a note; use for "note/remember/write down …". |
| `searchNotes` | `query` | `list<Note>` | Full-text search over titles, bodies and tags; use before answering questions about notes. |
| `listRecentNotes` | `limit?: int` | `list<Note>` | Most recently updated first. |
| `appendToNote` | `id`, `text` | `Note` | Add text to an existing note; get the id from search or list. |

- `Note` = `id`, `title`, `body`, `tags: list<string>`, `createdAt: instant`, `updatedAt: instant`.
- **No delete** until the confirmation feature exists (Phase 4). This matches the README's warning.
- Descriptions are where Gemini's accuracy comes from; they get tuned against real prompts in step 8.4.

### 8.3 App internals

- **Storage:** `react-native-mmkv` 4.3.2 + `react-native-nitro-modules` 0.37.1 (MMKV 4 requires Nitro). **New dependencies in the demo app only; needs approval.** RN 0.87 compatibility is unverified; it gets confirmed at the first build, with AsyncStorage 3.1.1 as the fallback.
- **State:** a small store (`useSyncExternalStore`, no extra dependency) persisted to MMKV. Handlers write through the store, so the open UI re-renders immediately; on a cold start (app closed) the write persists and shows when the app opens.
- **UI:** one screen designed for half of the unfolded fold (about 430 dp wide):
  - a header and note cards with tag chips and relative times;
  - a brief highlight plus an "✨ via assistant" badge on notes created or edited by a function call, using RN's built-in `Animated`;
  - no extra UI dependencies.

### 8.4 Steps

1. Scaffold `examples/notes`, `npm install react-native-app-functions@alpha react-native-mmkv react-native-nitro-modules`, and follow the library README setup (KSP, `apply from`, config).
2. Store, UI, handlers. Release build on `AppFunctions_Fold_API_37`.
3. Verify each function with `adb … execute-app-function` (cold and warm).
4. Install the Testing Agent with the privileged launch (fingerprint workaround). You enter your Gemini key in its Settings; it stays on the emulator, and I never see or store it. Disconnect other apps in the agent so only Notes' functions are offered.
5. Dry-run the storyboard prompts with Gemini and tune descriptions until it picks the right function every time.
6. Recording setup: the notes app plus the agent in split screen (taskbar drag; the adb launch-adjacent flag didn't split in a test). Record with the emulator's built-in screen recorder or `adb shell screenrecord --display-id <inner display>`.
7. `examples/notes/README.md`: what it shows and how to run it.

### 8.5 Storyboard (about 40 s, captions, no voiceover)

1. "Note: order 20 bags of cement for site B and call Juma on Friday" → `createNote`; the card appears on the right.
2. "What do I need to do for site B?" → `searchNotes`; Gemini answers from the app's data.
3. "Add 'bring the level' to that note" → `appendToNote`; the card updates live.
4. Close Notes, then ask "Create a shopping list note: milk, eggs, bread", then open Notes: the note is there (cold start).
5. End card: name, `npm install react-native-app-functions@alpha`, GitHub URL. Caption throughout: "Agent: Google's AppFunctions Testing Agent + Gemini".

### 8.6 Notes

- No library changes are planned, and no new release.
- The fold AVD is 2076×2152 unfolded (nearly square, good for feeds) and has two displays, so `screencap`/`screenrecord` need `-d/--display-id` (inner display: `dumpsys SurfaceFlinger --display-id`, first entry).
