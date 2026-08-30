#import <React/RCTBridgeModule.h>

// Exposes the Swift `GoatWebViewModule` (GoatWebViewModule.swift) TurboGoatWebViewSpec methods
// to the RN bridge (Task 10164), matching `GoatWebViewModule.kt` on Android.
@interface RCT_EXTERN_MODULE(GoatWebViewModule, NSObject)

RCT_EXTERN_METHOD(prewarm:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(clearCache:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getBundleVersion:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(executeAction:(NSString *)action payload:(NSDictionary *)payload appId:(NSString *)appId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(triggerHaptic:(NSString *)type style:(NSString *)style notificationType:(NSString *)notificationType resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(runHeadlessScript:(NSString *)script appId:(NSString *)appId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setNavBarState:(NSDictionary *)state appId:(NSString *)appId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setBottomSheetState:(NSDictionary *)state appId:(NSString *)appId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(notifyAppServiceReady:(NSString *)appId details:(NSDictionary *)details resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(notifyAppServiceCrash:(NSString *)appId error:(NSString *)error resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(notifyAppServiceTerminate:(NSString *)appId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

@end
