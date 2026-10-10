# react-native-app-functions

Expose React Native app functionality to on-device AI agents via Android [AppFunctions](https://developer.android.com/ai/appfunctions).

> **Status: early development.** Android only. AppFunctions itself is alpha (`androidx.appfunctions` `1.0.0-alpha13`), so expect breaking changes.

You declare functions in a static `appfunctions.config.ts`. At build time the library generates the Kotlin `@AppFunctionDeclaration` service, data classes, manifest entries and resources. Google's KSP processor then turns those into the schema Android indexes at install time. Your app implements each function natively in Kotlin; JS handlers are planned.

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
