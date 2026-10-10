// GENERATED — do not edit. Source: appfunctions.config.ts (react-native-app-functions).
package io.github.alvinotuya.appfunctions.example.appfunctions

import androidx.annotation.RequiresApi
import androidx.appfunctions.AppFunctionAppUnknownException
import androidx.appfunctions.AppFunctionDeclaration
import androidx.appfunctions.AppFunctionDeniedException
import androidx.appfunctions.AppFunctionElementAlreadyExistsException
import androidx.appfunctions.AppFunctionElementNotFoundException
import androidx.appfunctions.AppFunctionInvalidArgumentException
import androidx.appfunctions.AppFunctionLimitExceededException
import androidx.appfunctions.AppFunctionPermissionRequiredException
import androidx.appfunctions.AppFunctionService
import androidx.appfunctions.AppFunctionServiceEntryPoint
import io.github.alvinotuya.appfunctions.JsBridge
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import org.json.JSONTokener

/**
 * AppFunctions entry point. KSP generates the concrete `FieldAppFunctionService` subclass and
 * `assets/field_app_function_service.xml` (plus `field_app_function_service-v1.xml`) from this class.
 */
@RequiresApi(36)
@AppFunctionServiceEntryPoint(
  serviceName = "FieldAppFunctionService",
  appFunctionXmlFileName = "field_app_function_service",
)
abstract class BaseFieldAppFunctionService : AppFunctionService() {

  private val handlers: AppFunctionsHandlers
    get() =
      applicationContext as? AppFunctionsHandlers
        ?: throw AppFunctionAppUnknownException(
          "Application does not implement AppFunctionsHandlers"
        )

  /**
   * Lists the field records scheduled for today on this device, ordered by scheduled time.
   * Read-only: does not modify any record.
   *
   * @return Today's field records. Empty if nothing is scheduled today.
   */
  @AppFunctionDeclaration(isDescribedByKDoc = true)
  suspend fun listTodaysRecords(): List<FieldRecord> =
    withContext(Dispatchers.IO) { handlers.listTodaysRecordsHandler.listTodaysRecords() }

  /**
   * Finds one field record by its id. Read-only.
   * Ids come from listTodaysRecords.
   *
   * @param id The record id, e.g. "rec-001".
   * @return The record with that id.
   */
  @AppFunctionDeclaration(isDescribedByKDoc = true)
  suspend fun findRecord(
    id: String,
  ): FieldRecord {
    val args = JSONObject()
    args.put("id", id)
    val result = callJs("findRecord", args, 10000L)
    return decodeJsResult("findRecord") { AppFunctionsJson.decodeFieldRecord(result, "result") }
  }

  /** Runs the JS handler [name] via Headless JS and returns its parsed JSON result. */
  private suspend fun callJs(name: String, args: JSONObject, timeoutMs: Long): Any? {
    val result =
      withTimeoutOrNull(timeoutMs) {
        suspendCancellableCoroutine<JsBridge.Result> { cont ->
          val call =
            JsBridge.call(applicationContext, name, args.toString(), timeoutMs) { cont.resume(it) }
          cont.invokeOnCancellation { call.cancel() }
        }
      }
        ?: throw AppFunctionAppUnknownException(
          "JS handler \"$name\" did not respond within $timeoutMs ms"
        )
    return when (result) {
      is JsBridge.Result.Success -> JSONTokener(result.json).nextValue()
      is JsBridge.Result.Failure -> throw jsFailure(result)
    }
  }

  private fun jsFailure(failure: JsBridge.Result.Failure): Exception =
    when (failure.code) {
      "INVALID_ARGUMENT" -> AppFunctionInvalidArgumentException(failure.message)
      "NOT_FOUND" -> AppFunctionElementNotFoundException(failure.message)
      "DENIED" -> AppFunctionDeniedException(failure.message)
      "PERMISSION_REQUIRED" -> AppFunctionPermissionRequiredException(failure.message)
      "LIMIT_EXCEEDED" -> AppFunctionLimitExceededException(failure.message)
      "ALREADY_EXISTS" -> AppFunctionElementAlreadyExistsException(failure.message)
      else -> AppFunctionAppUnknownException(failure.message)
    }

  private inline fun <T> decodeJsResult(name: String, decode: () -> T): T =
    try {
      decode()
    } catch (e: AppFunctionsJson.InvalidValueException) {
      throw AppFunctionAppUnknownException("\"$name\" returned an invalid value: ${e.message}")
    }
}
