// GENERATED — do not edit. Source: appfunctions.config.ts (react-native-app-functions).
package io.github.alvinotuya.appfunctions.example.appfunctions

import androidx.appfunctions.AppFunctionSerializable
import java.time.LocalDateTime

/** A field record scheduled for the current day. */
@AppFunctionSerializable(isDescribedByKDoc = true)
data class FieldRecord(
  /** The unique identifier of the record. */
  val id: String,
  /** A short human-readable title describing the visit or task. */
  val title: String,
  /** The record status, one of "PENDING", "IN_PROGRESS" or "DONE". */
  val status: String,
  /** The local date and time the record is scheduled for, or null if unscheduled. */
  val scheduledAt: LocalDateTime?,
)
