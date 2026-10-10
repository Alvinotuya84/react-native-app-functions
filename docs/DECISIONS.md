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
