// GENERATED — do not edit. Source: appfunctions.config.ts (react-native-app-functions).
package io.github.alvinotuya.appfunctions.example.appfunctions

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeParseException
import org.json.JSONArray
import org.json.JSONObject

/**
 * JSON encoding for values exchanged with JS handlers. Dates and times are ISO-8601 strings;
 * decoding is strict and reports the path of the first invalid value.
 */
internal object AppFunctionsJson {
  class InvalidValueException(message: String) : Exception(message)

  fun encodeFieldRecord(v: FieldRecord): JSONObject {
    val o = JSONObject()
    o.put("id", v.id)
    o.put("title", v.title)
    o.put("status", v.status)
    o.put("scheduledAt", v.scheduledAt?.let { it.toString() } ?: JSONObject.NULL)
    return o
  }

  fun decodeFieldRecord(v: Any?, path: String): FieldRecord {
    val o = obj(v, path)
    return FieldRecord(
      id = string(o.opt("id"), "$path.id"),
      title = string(o.opt("title"), "$path.title"),
      status = string(o.opt("status"), "$path.status"),
      scheduledAt = orNull(o.opt("scheduledAt")) { localDateTime(it, "$path.scheduledAt") },
    )
  }

  fun isNull(v: Any?): Boolean = v == null || v == JSONObject.NULL

  inline fun <T> orNull(v: Any?, decode: (Any) -> T): T? = if (v == null || isNull(v)) null else decode(v)

  fun obj(v: Any?, path: String): JSONObject = v as? JSONObject ?: invalid(path, "an object", v)

  fun string(v: Any?, path: String): String = v as? String ?: invalid(path, "a string", v)

  fun boolean(v: Any?, path: String): Boolean = v as? Boolean ?: invalid(path, "a boolean", v)

  fun double(v: Any?, path: String): Double = (v as? Number)?.toDouble() ?: invalid(path, "a number", v)

  fun long(v: Any?, path: String): Long =
    when (v) {
      is Int -> v.toLong()
      is Long -> v
      is Number ->
        v.toDouble().let { d ->
          if (d % 1.0 == 0.0 && d >= Long.MIN_VALUE.toDouble() && d <= Long.MAX_VALUE.toDouble()) {
            d.toLong()
          } else {
            invalid(path, "an integer", v)
          }
        }
      else -> invalid(path, "an integer", v)
    }

  fun int(v: Any?, path: String): Int {
    val l = long(v, path)
    if (l < Int.MIN_VALUE || l > Int.MAX_VALUE) invalid(path, "a 32-bit integer", v)
    return l.toInt()
  }

  fun localDate(v: Any?, path: String): LocalDate =
    parse(v, path, "an ISO-8601 date like 2026-10-10") { LocalDate.parse(it) }

  fun localDateTime(v: Any?, path: String): LocalDateTime =
    parse(v, path, "an ISO-8601 local date-time like 2026-10-10T08:30") { LocalDateTime.parse(it) }

  fun instant(v: Any?, path: String): Instant =
    parse(v, path, "an ISO-8601 instant like 2026-10-10T08:30:00Z") { Instant.parse(it) }

  inline fun <T> list(v: Any?, path: String, item: (Any?, String) -> T): List<T> {
    val a = v as? JSONArray ?: invalid(path, "an array", v)
    return List(a.length()) { i -> item(a.opt(i), "$path[$i]") }
  }

  inline fun <T> parse(v: Any?, path: String, expected: String, parse: (String) -> T): T {
    val s = string(v, path)
    return try {
      parse(s)
    } catch (e: DateTimeParseException) {
      invalid(path, expected, v)
    }
  }

  fun invalid(path: String, expected: String, v: Any?): Nothing =
    throw InvalidValueException(
      if (isNull(v)) "$path is missing or null, expected $expected"
      else "$path: expected $expected, got ${describe(v)}"
    )

  private fun describe(v: Any?): String =
    when (v) {
      is JSONObject -> "an object"
      is JSONArray -> "an array"
      is String -> "\"${v.take(40)}\""
      else -> v.toString()
    }
}
