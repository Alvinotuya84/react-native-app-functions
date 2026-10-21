#import "AppFunctions.h"

#if __has_include(<AppFunctions/AppFunctions-Swift.h>)
#import <AppFunctions/AppFunctions-Swift.h>
#else
#import "AppFunctions-Swift.h"
#endif

// Bridges JS handlers to App Intents generated with `handler: "js"` (see AppFunctionsJsBridge.swift).
@implementation AppFunctions

- (void)ready {
  __weak AppFunctions *weakSelf = self;
  [AppFunctionsJsBridge.shared setEmitter:^(NSDictionary<NSString *, NSString *> *call) {
    [weakSelf emitOnCall:call];
  }];
}

- (void)completeCall:(NSString *)callId resultJson:(NSString *)resultJson {
  [AppFunctionsJsBridge.shared complete:callId resultJson:resultJson];
}

- (void)failCall:(NSString *)callId code:(NSString *)code message:(NSString *)message {
  [AppFunctionsJsBridge.shared fail:callId code:code message:message];
}

- (void)invalidate {
  [AppFunctionsJsBridge.shared clearEmitter];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeAppFunctionsSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"AppFunctions";
}

@end
