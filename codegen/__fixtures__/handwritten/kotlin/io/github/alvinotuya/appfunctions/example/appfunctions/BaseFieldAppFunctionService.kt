// GENERATED — do not edit. Source: appfunctions.config.ts (react-native-app-functions).
package io.github.alvinotuya.appfunctions.example.appfunctions

import androidx.annotation.RequiresApi
import androidx.appfunctions.AppFunctionAppUnknownException
import androidx.appfunctions.AppFunctionDeclaration
import androidx.appfunctions.AppFunctionService
import androidx.appfunctions.AppFunctionServiceEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

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
}
