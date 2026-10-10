package io.github.alvinotuya.appfunctions.example.appfunctions

/** Native implementation of the `listTodaysRecords` AppFunction, provided by the app. */
fun interface ListTodaysRecordsHandler {
  suspend fun listTodaysRecords(): List<FieldRecord>
}

/**
 * Implemented by the app's [android.app.Application] so the AppFunction service can reach the
 * handlers without depending on React Native or a DI framework.
 */
interface FieldAppFunctionsHandlers {
  val listTodaysRecordsHandler: ListTodaysRecordsHandler
}
