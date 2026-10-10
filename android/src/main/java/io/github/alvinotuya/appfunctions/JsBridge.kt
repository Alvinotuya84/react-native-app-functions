package io.github.alvinotuya.appfunctions

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.facebook.react.ReactApplication
import com.facebook.react.ReactInstanceEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import com.facebook.react.jstasks.HeadlessJsTaskEventListener
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Runs an AppFunction's JS handler as a Headless JS task and reports its result.
 *
 * Called from generated AppFunction code. Starts the React instance if the app is not running
 * (cold start), then starts the "ReactNativeAppFunctions" task, which looks up the handler
 * registered with `registerAppFunctionHandler` and reports back through [AppFunctionsModule].
 *
 * Deliberately free of `androidx.appfunctions` and coroutines: generated code owns the timeout,
 * cancellation and the mapping to AppFunction exceptions.
 */
object JsBridge : HeadlessJsTaskEventListener {
  /** Headless task key registered by the library's JS entry point. */
  const val TASK_KEY: String = "ReactNativeAppFunctions"

  /** Grace period after the JS task finishes for its result call to arrive. */
  private const val RESULT_GRACE_MS = 500L

  sealed interface Result {
    /** The handler's return value, as JSON text. */
    data class Success(val json: String) : Result

    /** `code` is one of the JS `AppFunctionErrorCode`s, or `UNKNOWN`, `NOT_REGISTERED`, `NO_RESULT`, `NOT_AVAILABLE`. */
    data class Failure(val code: String, val message: String) : Result
  }

  fun interface Callback {
    fun onResult(result: Result)
  }

  fun interface Call {
    /** Drops the call; its callback will not be invoked. */
    fun cancel()
  }

  private class Pending(val functionName: String, val callback: Callback)

  private val pending = ConcurrentHashMap<String, Pending>()
  private val callIdByTaskId = ConcurrentHashMap<Int, String>()
  private val mainHandler = Handler(Looper.getMainLooper())

  /**
   * Invokes the JS handler for [functionName] with [argsJson]. [callback] is called exactly once,
   * on any thread, unless the returned [Call] is cancelled first.
   *
   * @param taskTimeoutMs safety net for the Headless JS task itself; the caller enforces its own
   *   timeout and cancels.
   */
  fun call(
    context: Context,
    functionName: String,
    argsJson: String,
    taskTimeoutMs: Long,
    callback: Callback,
  ): Call {
    val callId = UUID.randomUUID().toString()
    pending[callId] = Pending(functionName, callback)
    UiThreadUtil.runOnUiThread {
      try {
        withReactContext(context.applicationContext, callId) { reactContext ->
          startTask(reactContext, callId, functionName, argsJson, taskTimeoutMs)
        }
      } catch (e: Exception) {
        finish(callId, Result.Failure("NOT_AVAILABLE", "Could not start JS handler: ${e.message}"))
      }
    }
    return Call { pending.remove(callId) }
  }

  /** Called by [AppFunctionsModule] when the JS handler returns. */
  fun completeCall(callId: String, resultJson: String) {
    finish(callId, Result.Success(resultJson))
  }

  /** Called by [AppFunctionsModule] when the JS handler throws or is missing. */
  fun failCall(callId: String, code: String, message: String) {
    finish(callId, Result.Failure(code, message))
  }

  private fun finish(callId: String, result: Result) {
    pending.remove(callId)?.callback?.onResult(result)
  }

  private fun withReactContext(appContext: Context, callId: String, block: (ReactContext) -> Unit) {
    val reactHost =
      (appContext as? ReactApplication)?.reactHost
        ?: run {
          finish(
            callId,
            Result.Failure(
              "NOT_AVAILABLE",
              "JS handlers need an Application implementing ReactApplication with a ReactHost (New Architecture).",
            ),
          )
          return
        }
    val current = reactHost.currentReactContext
    if (current != null) {
      block(current)
      return
    }
    // Cold start: same sequence as HeadlessJsTaskService under bridgeless.
    reactHost.addReactInstanceEventListener(
      object : ReactInstanceEventListener {
        override fun onReactContextInitialized(context: ReactContext) {
          reactHost.removeReactInstanceEventListener(this)
          UiThreadUtil.runOnUiThread { block(context) }
        }
      }
    )
    reactHost.start()
  }

  private fun startTask(
    reactContext: ReactContext,
    callId: String,
    functionName: String,
    argsJson: String,
    taskTimeoutMs: Long,
  ) {
    if (!pending.containsKey(callId)) return // cancelled while React was starting
    val data =
      Arguments.createMap().apply {
        putString("callId", callId)
        putString("name", functionName)
        putString("argsJson", argsJson)
      }
    val tasks = HeadlessJsTaskContext.getInstance(reactContext)
    tasks.addTaskEventListener(this)
    // Allowed in foreground: an agent can call while the app is open.
    val taskId = tasks.startTask(HeadlessJsTaskConfig(TASK_KEY, data, taskTimeoutMs, true))
    callIdByTaskId[taskId] = callId
  }

  override fun onHeadlessJsTaskStart(taskId: Int) = Unit

  override fun onHeadlessJsTaskFinish(taskId: Int) {
    val callId = callIdByTaskId.remove(taskId) ?: return
    // The result arrives through a separate native module call; give it a moment before failing.
    mainHandler.postDelayed(
      {
        val name = pending[callId]?.functionName ?: return@postDelayed
        finish(
          callId,
          Result.Failure(
            "NO_RESULT",
            "The JS task for \"$name\" finished without a result. Is registerAppFunctionHandler(\"$name\", …) called at the top level of index.js?",
          ),
        )
      },
      RESULT_GRACE_MS,
    )
  }
}
