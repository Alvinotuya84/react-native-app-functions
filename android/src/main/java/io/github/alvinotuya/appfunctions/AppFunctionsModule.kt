package io.github.alvinotuya.appfunctions

import com.facebook.react.bridge.ReactApplicationContext

class AppFunctionsModule(reactContext: ReactApplicationContext) :
  NativeAppFunctionsSpec(reactContext) {

  override fun completeCall(callId: String, resultJson: String) {
    JsBridge.completeCall(callId, resultJson)
  }

  override fun failCall(callId: String, code: String, message: String) {
    JsBridge.failCall(callId, code, message)
  }

  companion object {
    const val NAME = NativeAppFunctionsSpec.NAME
  }
}
