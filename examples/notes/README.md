# Notes: react-native-app-functions demo

A small notes app that lets on-device AI agents **create, search, list and update notes** through Android AppFunctions, built with [`react-native-app-functions`](../../README.md) (installed from npm, `@alpha`).

- Functions are declared in [`appfunctions.config.ts`](appfunctions.config.ts): `createNote`, `searchNotes`, `listRecentNotes` and `appendToNote` (no delete; see the library's security note).
- All four are **JS handlers** ([`src/appFunctions.ts`](src/appFunctions.ts)) that write through the same store the UI renders ([`src/notesStore.ts`](src/notesStore.ts), persisted with MMKV). Agent changes show up live, with a "✨ via assistant" badge, and calls also work when the app is closed.

## Run it

Requires an Android 16 QPR or Android 17 device or emulator (a foldable or tablet looks best for the side-by-side demo).

```sh
cd examples/notes
npm install
cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
adb install -r app/build/outputs/apk/release/app-release.apk
```

Call a function without an agent:

```sh
adb shell "cmd app_function execute-app-function --package io.github.alvinotuya.notes \
  --function 'io.github.alvinotuya.notes.appfunctions.BaseNotesAppFunctionService#createNote' \
  --parameters '{\"title\":\"Site B supplies\",\"body\":\"Order 20 bags of cement\"}'"
```

Reset the demo data: `adb shell pm clear io.github.alvinotuya.notes`.

## With an LLM agent

Use Google's [AppFunctions Testing Agent](https://github.com/android/appfunctions/tree/main/agent) ("Agent Demo" tab with a Gemini API key entered in its Settings). It must run with shell identity; see the library README's testing section for the launch steps and the Android 17 emulator fingerprint workaround. In the agent's settings, disconnect other apps so only Notes' functions are offered.

Try: "Note: order 20 bags of cement for site B and call Juma on Friday", then "What do I need to do for site B?", then "Add 'bring the level' to that note".
