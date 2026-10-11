import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  /** Delivers a JS handler's result (JSON) for an in-flight AppFunction call. */
  completeCall(callId: string, resultJson: string): void;
  /** Fails an in-flight AppFunction call. `code` is an `AppFunctionErrorCode` or `UNKNOWN`. */
  failCall(callId: string, code: string, message: string): void;
}

export default TurboModuleRegistry.get<Spec>('AppFunctions');
