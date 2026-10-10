package io.github.alvinotuya.appfunctions

import com.facebook.react.bridge.ReactApplicationContext

class AppFunctionsModule(reactContext: ReactApplicationContext) :
  NativeAppFunctionsSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeAppFunctionsSpec.NAME
  }
}
