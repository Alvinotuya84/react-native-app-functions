#import "AppFunctions.h"

// AppFunctions is Android-only; iOS keeps a no-op module so the spec builds.
@implementation AppFunctions
- (void)completeCall:(NSString *)callId resultJson:(NSString *)resultJson {
}

- (void)failCall:(NSString *)callId code:(NSString *)code message:(NSString *)message {
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
