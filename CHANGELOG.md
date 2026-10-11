# Changelog

## 0.1.0-alpha.0 (2026-10-10)

First public alpha, for validation. Android only, bare React Native 0.87+.

- Declare AppFunctions in `appfunctions.config.ts` (`defineAppFunctions` from `react-native-app-functions/config`). The config is parsed at build time, never executed, and invalid config fails the build with a message naming the function and field.
- Build integration: `android/appfunctions.gradle` runs the code generator before KSP and wires the generated Kotlin, manifest and resources into the app. Uses `androidx.appfunctions` `1.0.0-alpha13`.
- Generates the `@AppFunctionServiceEntryPoint` service, `@AppFunctionSerializable` data classes, the manifest service entry (including the legacy v1 index needed by Android 16) and app metadata.
- `handler: 'native'`: Kotlin handlers implemented on your `Application` (`AppFunctionsHandlers`). They work with the app killed and don't need the JS runtime.
- `handler: 'js'`: JS handlers via `registerAppFunctionHandler`, run as Headless JS (cold start supported, works in the foreground). Argument and return types are derived from the config. `AppFunctionError` codes map to AppFunction exceptions. Results are validated strictly, with a per-function `timeoutMs`.
- Known gap: **no auth gate yet**, so expose only read-only, non-sensitive data.
