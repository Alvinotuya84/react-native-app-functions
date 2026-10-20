# Hand-written reference

This folder holds the expected codegen output for `appfunctions.config.ts`, written by hand from the Phase 1 example (commit `2944a08` plus the Android 16 v1 fix in `11c86c1`). `__tests__/render.test.ts` asserts the generator reproduces it exactly.

Deliberate changes from the Phase 1 files, decided in Phase 2:

- A `// GENERATED — do not edit` header on every file.
- `Handlers.kt` → `AppFunctionsHandlers.kt`, and `FieldAppFunctionsHandlers` → `AppFunctionsHandlers` (a fixed name, so apps don't depend on the service name).
- `appFunctionXmlFileName` is the snake_case of `serviceName` (`field_app_function_service`), following Google's sample convention, instead of `field_app_functions`.
- Resources are prefixed `appfunctions_` (`appfunctions_app_metadata.xml`, `appfunctions_display_description`) to avoid clashing with app resources.
- Manifest entries live in a standalone manifest overlay (`manifest/AndroidManifest.xml`) that AGP merges in, instead of being edited into the app's manifest.

Function IDs keep the Phase 1 shape: `<kotlinPackage>.Base<serviceName>#<function>`.

## iOS (`ios/AppFunctions.generated.swift`)

Written by hand from the iOS slice 1 example (`example/ios/AppFunctionsExample/AppFunctionsIntents.swift`, commit `c53b237`), which compiled and ran in Shortcuts. Deliberate changes, decided in iOS slice 2:

- The `// GENERATED — do not edit` header.
- The entity property for the `id` field is `fieldRecordId` (`<type><Field>`, a derivable rule) instead of `recordId`.
- The handler result is bound to `value` instead of `records`.
