package io.github.alvinotuya.appfunctions.example

import io.github.alvinotuya.appfunctions.example.appfunctions.FieldRecord
import io.github.alvinotuya.appfunctions.example.appfunctions.ListTodaysRecordsHandler
import java.time.LocalDate

/** Stand-in for the field-agent app's SQLite query. Only invoked on Android 16+. */
object DummyListTodaysRecordsHandler : ListTodaysRecordsHandler {
  override suspend fun listTodaysRecords(): List<FieldRecord> {
    val today = LocalDate.now()
    return listOf(
      FieldRecord("rec-001", "Inspect water pump, Site A", "DONE", today.atTime(8, 30)),
      FieldRecord("rec-002", "Meter reading, Block 4", "IN_PROGRESS", today.atTime(11, 0)),
      FieldRecord("rec-003", "Customer follow-up call", "PENDING", null),
    )
  }
}
