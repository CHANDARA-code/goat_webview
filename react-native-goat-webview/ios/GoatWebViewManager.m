#import <React/RCTViewManager.h>
#import <React/RCTBridgeModule.h>

// Exposes the Swift `GoatWebViewManager` (GoatWebViewManager.swift) and the KVC-settable
// properties on `GoatWebViewViewIOS` (GoatWebViewViewIOS.swift) to the RN bridge, matching the
// prop surface already implemented for Android in `GoatWebViewManager.kt` (Task 10164).
@interface RCT_EXTERN_MODULE(GoatWebViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(appId, NSString)
RCT_EXPORT_VIEW_PROPERTY(assetBundleName, NSString)
RCT_EXPORT_VIEW_PROPERTY(popupRoutingPolicy, NSString)

// Navigation Bar Props
RCT_EXPORT_VIEW_PROPERTY(navBarTitle, NSString)
RCT_EXPORT_VIEW_PROPERTY(navBarSubtitle, NSString)
RCT_EXPORT_VIEW_PROPERTY(navBarBackgroundColor, NSString)
RCT_EXPORT_VIEW_PROPERTY(navBarTextColor, NSString)
RCT_EXPORT_VIEW_PROPERTY(navBarVisible, BOOL)
RCT_EXPORT_VIEW_PROPERTY(navBarProgress, NSNumber)

// Bottom Sheet Props
RCT_EXPORT_VIEW_PROPERTY(bottomSheetSnapPoints, NSArray)
RCT_EXPORT_VIEW_PROPERTY(bottomSheetInitialSnap, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(bottomSheetDismissible, BOOL)
RCT_EXPORT_VIEW_PROPERTY(bottomSheetShowDragHandle, BOOL)
RCT_EXPORT_VIEW_PROPERTY(bottomSheetVisible, BOOL)

// Direct Events
RCT_EXPORT_VIEW_PROPERTY(onBridgeMessage, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onPageStarted, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onPageLoaded, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onProgressChanged, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onReceivedTitle, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onInsetsChange, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onSheetStateChange, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onError, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onAppServiceReady, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onAppServiceCrash, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onAppServiceTerminate, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onPopupRequest, RCTDirectEventBlock)

@end
