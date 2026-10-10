package io.github.alvinotuya.appfunctions.example.appfunctions

import androidx.annotation.RequiresApi
import androidx.appfunctions.AppFunctionAppUnknownException
import androidx.appfunctions.AppFunctionDeclaration
import androidx.appfunctions.AppFunctionService
import androidx.appfunctions.AppFunctionServiceEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Hand-written Phase 1 reference. KSP generates the concrete `FieldAppFunctionService` subclass
 * and `assets/field_app_functions.xml` from this class.
 */
@RequiresApi(36)
@AppFunctionServiceEntryPoint(
  serviceName = "FieldAppFunctionService",
  appFunctionXmlFileName = "field_app_functions",
)
abstract class BaseFieldAppFunctionService : AppFunctionService() {

  private val handlers: FieldAppFunctionsHandlers
    get() =
      applicationContext as? FieldAppFunctionsHandlers
        ?: throw AppFunctionAppUnknownException(
          "Application does not implement FieldAppFunctionsHandlers"
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
