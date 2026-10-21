import {
  TurboModuleRegistry,
  type CodegenTypes,
  type TurboModule,
} from 'react-native';

/** An AppFunction call for a JS handler (iOS; Android delivers calls as a Headless JS task). */
export type AppFunctionCall = {
  callId: string;
  name: string;
  argsJson: string;
};

export interface Spec extends TurboModule {
  /** Delivers a JS handler's result (JSON) for an in-flight AppFunction call. */
  completeCall(callId: string, resultJson: string): void;
  /** Fails an in-flight AppFunction call. `code` is an `AppFunctionErrorCode` or `UNKNOWN`. */
  failCall(callId: string, code: string, message: string): void;
  /** iOS: JS is subscribed to `onCall`; native delivers queued calls from now on. No-op on Android. */
  ready(): void;
  /** iOS: an App Intent wants a JS handler to run. */
  readonly onCall: CodegenTypes.EventEmitter<AppFunctionCall>;
}

export default TurboModuleRegistry.get<Spec>('AppFunctions');
