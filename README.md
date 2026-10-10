# react-native-app-functions

Expose React Native app functionality to on-device AI agents via Android [AppFunctions](https://developer.android.com/ai/appfunctions).

> **Status: early development.** Android only. AppFunctions itself is alpha (`androidx.appfunctions` `1.0.0-alpha13`), so expect breaking changes.

You declare functions in a static `appfunctions.config.ts`. At build time the library generates the Kotlin `@AppFunctionDeclaration` service, data classes, manifest entries and resources. Google's KSP processor then turns those into the schema Android indexes at install time. Each function is implemented either natively in Kotlin (`handler: 'native'`) or in JavaScript (`handler: 'js'`, run as a Headless JS task).

## Requirements

- React Native **0.87+**. AppFunctions requires AGP 9.1+ and compileSdk 37.
- The KSP Gradle plugin (`com.google.devtools.ksp`; tested with the version in [`versions.json`](versions.json)).
- Functions are available to agents on Android 16+. On older versions the app builds and runs normally, and the functions are simply absent.

## Setup (bare React Native)

1. Add KSP to `android/build.gradle`:

   ```groovy
   buildscript {
     dependencies {
       classpath("com.google.devtools.ksp:symbol-processing-gradle-plugin:2.3.12")
     }
   }
   ```

2. In `android/app/build.gradle`, apply KSP and this library's script:

   ```groovy
   apply plugin: "com.google.devtools.ksp"
   // ... at the end of the file:
   apply from: "../../node_modules/react-native-app-functions/android/appfunctions.gradle"
   ```

3. Create `appfunctions.config.ts` next to your `package.json`:

   ```ts
   import { defineAppFunctions } from 'react-native-app-functions/config';

   export default defineAppFunctions({
     android: {
       kotlinPackage: 'com.example.app.appfunctions',
       serviceName: 'MyAppFunctionService',
       appDescription: 'What this app lets agents do, and how to use its functions.',
     },
     types: {
       Visit: {
         description: 'A scheduled visit.',
         fields: {
           id: { type: 'string', description: 'Unique id.' },
           at: { type: 'localDateTime', nullable: true, description: 'Scheduled time.' },
         },
       },
     },
     functions: {
       listTodaysVisits: {
         description: "Lists today's visits. Read-only.",
         handler: 'native',
         returns: { type: 'list', of: 'Visit' },
       },
     },
   });
   ```

   The file is parsed at build time and **never executed**, so use literal values only. Invalid config fails the build with a message naming the function and field.

   Types: `string`, `int`, `long`, `double`, `boolean`, `localDate`, `localDateTime`, `instant`, any type declared under `types`, and `{ type: 'list', of: ... }` (of `string`, date/time types or declared types). Any value can be `nullable`.

4. Build once, then implement the generated handler interfaces on your `Application`:

   ```kotlin
   class MainApplication : Application(), ReactApplication, AppFunctionsHandlers {
     override val listTodaysVisitsHandler = ListTodaysVisitsHandler { visitsRepository.today() }
     // ...
   }
   ```

   Handlers run off the main thread and do not need the JS runtime, so they work when the app is not running.

## JS handlers

Set `handler: 'js'` to implement a function in JavaScript (optional `timeoutMs`, default 10000):

```ts
// appfunctions.config.ts
findRecord: {
  description: 'Finds one record by its id. Read-only.',
  handler: 'js',
  params: { id: { type: 'string', description: 'The record id.' } },
  returns: { type: 'FieldRecord' },
},
```

Register the handler in a module imported at the **top level of `index.js`**, before `AppRegistry.registerComponent`. Agent calls can start your app headless, without mounting any component:

```ts
// src/appFunctions.ts, imported first thing in index.js
import { AppFunctionError, registerAppFunctionHandler } from 'react-native-app-functions';
import type config from '../appfunctions.config';

registerAppFunctionHandler<typeof config, 'findRecord'>('findRecord', async ({ id }) => {
  const row = await db.getRecord(id);
  if (!row) throw new AppFunctionError('NOT_FOUND', `No record "${id}"`);
  return row; // type-checked against the config
});
```

- **Types:** argument and return types are derived from `typeof config`, with no extra codegen step.
- **Values:** dates and times are ISO-8601 strings (`localDate` `"2026-10-10"`, `localDateTime` `"2026-10-10T08:30"`, `instant` `"2026-10-10T08:30:00Z"`). Nullable fields may be omitted or `null`. `long` values above 2^53 lose precision.
- **Errors:** throw `AppFunctionError(code, message)` with `INVALID_ARGUMENT`, `NOT_FOUND`, `DENIED`, `PERMISSION_REQUIRED`, `LIMIT_EXCEEDED` or `ALREADY_EXISTS` to give the agent a specific error. Any other error, an invalid return value, or a timeout reaches the agent as an app error with a message.
- **How it runs:** the call runs as a Headless JS task. If the app isn't running, React Native is started first. Handlers share the JS thread with your UI, so keep them short.
- **Debug builds:** in debug builds, a cold start loads the bundle from Metro. Without Metro running, JS functions time out (native functions still work).

## Testing on a device

On an Android 16 QPR or Android 17 device or emulator:

```sh
adb shell cmd app_function list-app-functions
adb shell "cmd app_function execute-app-function --package <applicationId> \
  --function '<kotlinPackage>.Base<serviceName>#<function>' --parameters '{}'"
```

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
