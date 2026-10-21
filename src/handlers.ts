import { AppRegistry, Platform } from 'react-native';
import NativeAppFunctions from './NativeAppFunctions';
import type {
  AppFunctionScalarType,
  AppFunctionValueSpec,
  AppFunctionsConfig,
} from './config';

/** Headless JS task key; must match `JsBridge.TASK_KEY` in Kotlin. */
const TASK_KEY = 'ReactNativeAppFunctions';

/** Error codes a JS handler can report; each maps to an `AppFunction*Exception` for the agent. */
export type AppFunctionErrorCode =
  | 'INVALID_ARGUMENT'
  | 'NOT_FOUND'
  | 'DENIED'
  | 'PERMISSION_REQUIRED'
  | 'LIMIT_EXCEEDED'
  | 'ALREADY_EXISTS';

/** Throw from a handler to give the agent a specific, actionable failure. */
export class AppFunctionError extends Error {
  constructor(
    readonly code: AppFunctionErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AppFunctionError';
  }
}

// ---- Handler types, derived from `typeof config` -------------------------------------------

type ScalarJs = {
  string: string;
  int: number;
  long: number;
  double: number;
  boolean: boolean;
  /** ISO-8601 date, e.g. `2026-10-10`. */
  localDate: string;
  /** ISO-8601 local date-time, e.g. `2026-10-10T08:30`. */
  localDateTime: string;
  /** ISO-8601 instant, e.g. `2026-10-10T08:30:00Z`. */
  instant: string;
};

type Types<C> = C extends { types: infer T } ? T : {};

type ItemJs<C, T> = T extends AppFunctionScalarType
  ? ScalarJs[T]
  : T extends keyof Types<C>
    ? Types<C>[T] extends { fields: infer F }
      ? FieldsJs<C, F>
      : never
    : unknown;

type ValueJs<C, V> = V extends { type: 'list'; of: infer O }
  ? OrNull<V, ItemJs<C, O>[]>
  : V extends { type: infer T }
    ? OrNull<V, ItemJs<C, T>>
    : never;

type OrNull<V, X> = V extends { nullable: true } ? X | null : X;

type FieldsJs<C, F> = {
  [K in keyof F as F[K] extends { nullable: true } ? never : K]: ValueJs<
    C,
    F[K]
  >;
} & {
  [K in keyof F as F[K] extends { nullable: true } ? K : never]?: ValueJs<
    C,
    F[K]
  >;
};

type Fn<
  C extends AppFunctionsConfig,
  N extends keyof C['functions'],
> = C['functions'][N];

/** Arguments a JS handler receives for function `N` of config `C`. */
export type AppFunctionArgs<
  C extends AppFunctionsConfig,
  N extends keyof C['functions'],
> = Fn<C, N> extends { params: infer P } ? FieldsJs<C, P> : {};

/** What a JS handler for function `N` of config `C` must return. */
export type AppFunctionResult<
  C extends AppFunctionsConfig,
  N extends keyof C['functions'],
> =
  Fn<C, N> extends { returns: infer R extends AppFunctionValueSpec }
    ? ValueJs<C, R>
    : never;

export type AppFunctionHandler<
  C extends AppFunctionsConfig,
  N extends keyof C['functions'],
> = (
  args: AppFunctionArgs<C, N>
) => AppFunctionResult<C, N> | Promise<AppFunctionResult<C, N>>;

// ---- Registry + headless task ----------------------------------------------------------------

type AnyHandler = (args: any) => unknown;
const handlers = new Map<string, AnyHandler>();

/**
 * Registers the JS implementation of an AppFunction declared with `handler: 'js'`.
 *
 * Call at the top level of `index.js` (before `AppRegistry.registerComponent`): agent calls can
 * start the app headless, without mounting any component.
 *
 * ```ts
 * import type config from './appfunctions.config';
 * registerAppFunctionHandler<typeof config, 'findRecord'>('findRecord', async ({ id }) => …);
 * ```
 */
export function registerAppFunctionHandler<
  C extends AppFunctionsConfig,
  N extends keyof C['functions'] & string,
>(name: N, handler: AppFunctionHandler<C, N>): void {
  handlers.set(name, handler as AnyHandler);
}

type TaskData = { callId: string; name: string; argsJson: string };

async function runCall({ callId, name, argsJson }: TaskData): Promise<void> {
  const native = NativeAppFunctions;
  if (!native) return;
  const handler = handlers.get(name);
  if (!handler) {
    native.failCall(
      callId,
      'NOT_REGISTERED',
      `No JS handler registered for "${name}". Call registerAppFunctionHandler("${name}", …) at the top level of index.js.`
    );
    return;
  }
  try {
    const result = await handler(JSON.parse(argsJson));
    native.completeCall(callId, JSON.stringify(result ?? null));
  } catch (e) {
    if (e instanceof AppFunctionError) {
      native.failCall(callId, e.code, e.message);
    } else {
      native.failCall(
        callId,
        'UNKNOWN',
        e instanceof Error ? e.message : String(e)
      );
    }
  }
}

if (Platform.OS === 'ios') {
  // App Intents reach JS through the module's `onCall` event. `ready()` tells native we are
  // subscribed, so it delivers calls queued while JS was starting. Events arrive asynchronously,
  // after the bundle's top-level code (including registerAppFunctionHandler calls) has run.
  const native = NativeAppFunctions;
  if (native) {
    native.onCall((call) => {
      runCall(call);
    });
    native.ready();
  }
} else {
  // The task never rejects: failures are reported through failCall, so no red box / retry logic.
  AppRegistry.registerHeadlessTask(TASK_KEY, () => runCall);
}
