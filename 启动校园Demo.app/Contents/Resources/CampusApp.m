#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <CoreGraphics/CoreGraphics.h>

static NSString *KeyCodeToDOMCode(unsigned short keyCode) {
  switch (keyCode) {
    case 13: return @"KeyW";
    case 0:  return @"KeyA";
    case 1:  return @"KeyS";
    case 2:  return @"KeyD";
    case 14: return @"KeyE";
    case 4:  return @"KeyH";
    case 46: return @"KeyM";
    case 15: return @"KeyR";
    case 49: return @"Space";
    case 36:
    case 76: return @"Enter";
    case 53: return @"Escape";
    case 126: return @"ArrowUp";
    case 125: return @"ArrowDown";
    case 123: return @"ArrowLeft";
    case 124: return @"ArrowRight";
    case 56: return @"ShiftLeft";
    case 60: return @"ShiftRight";
    default: return nil;
  }
}

@interface AppDelegate : NSObject <NSApplicationDelegate, NSWindowDelegate, WKScriptMessageHandler, WKNavigationDelegate>
@property (strong, nonatomic) NSWindow *window;
@property (strong, nonatomic) WKWebView *webView;
@property (strong, nonatomic) NSTask *serverTask;
@property (assign, nonatomic) BOOL isPointerLocked;
@property (assign, nonatomic) BOOL cursorHidden;
@property (strong, nonatomic) id eventMonitor;
@property (assign, nonatomic) NSInteger port;
@end

@implementation AppDelegate

- (instancetype)init {
  self = [super init];
  if (self) {
    _port = 4173;
  }
  return self;
}

- (NSString *)resolveProjectRoot {
  NSString *bundlePath = [[NSBundle mainBundle] bundlePath];
  NSString *parentDir = [bundlePath stringByDeletingLastPathComponent];
  NSFileManager *fm = [NSFileManager defaultManager];
  if ([fm fileExistsAtPath:[parentDir stringByAppendingPathComponent:@"index.html"]]) {
    return parentDir;
  }
  NSString *fallback = @"/Users/iewuui/Desktop/数媒比赛";
  if ([fm fileExistsAtPath:[fallback stringByAppendingPathComponent:@"index.html"]]) {
    return fallback;
  }
  return parentDir;
}

- (void)startServerIfNeeded {
  NSString *root = [self resolveProjectRoot];
  NSString *serverScript = [[[NSBundle mainBundle] resourcePath] stringByAppendingPathComponent:@"server.py"];
  NSTask *task = [[NSTask alloc] init];
  task.executableURL = [NSURL fileURLWithPath:@"/usr/bin/python3"];
  task.arguments = @[serverScript, root, [NSString stringWithFormat:@"%ld", (long)self.port]];
  task.currentDirectoryURL = [NSURL fileURLWithPath:root];
  task.standardOutput = [NSFileHandle fileHandleWithNullDevice];
  task.standardError = [NSFileHandle fileHandleWithNullDevice];
  NSError *err = nil;
  if ([task launchAndReturnError:&err]) {
    self.serverTask = task;
  }
}

- (void)setPointerLock:(BOOL)locked notifyJS:(BOOL)notifyJS {
  if (locked) {
    [self.window makeFirstResponder:self.webView];
    if (!self.isPointerLocked) {
      self.isPointerLocked = YES;
      NSScreen *screen = self.window.screen ?: [NSScreen mainScreen];
      if (screen && self.window) {
        CGFloat screenHeight = screen.frame.size.height;
        NSRect winFrame = self.window.frame;
        CGPoint center = CGPointMake(NSMidX(winFrame), screenHeight - NSMidY(winFrame));
        CGWarpMouseCursorPosition(center);
      }
      CGAssociateMouseAndMouseCursorPosition(false);
      if (!self.cursorHidden) {
        [NSCursor hide];
        self.cursorHidden = YES;
      }
    }
  } else {
    if (self.isPointerLocked || self.cursorHidden) {
      self.isPointerLocked = NO;
      CGAssociateMouseAndMouseCursorPosition(true);
      if (self.cursorHidden) {
        [NSCursor unhide];
        self.cursorHidden = NO;
      }
      if (notifyJS && self.webView) {
        [self.webView evaluateJavaScript:@"window.__onNativePointerLockChange && window.__onNativePointerLockChange(false);" completionHandler:nil];
      }
    }
  }
}

- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
  if (![message.name isEqualToString:@"pointerLock"]) return;
  if (![message.body isKindOfClass:[NSDictionary class]]) return;
  NSString *action = message.body[@"action"];
  if ([action isEqualToString:@"lock"]) {
    [self setPointerLock:YES notifyJS:NO];
  } else if ([action isEqualToString:@"unlock"]) {
    [self setPointerLock:NO notifyJS:NO];
  }
}

- (void)setupMenus {
  NSMenu *mainMenu = [[NSMenu alloc] init];

  NSMenuItem *appMenuItem = [[NSMenuItem alloc] init];
  [mainMenu addItem:appMenuItem];
  NSMenu *appMenu = [[NSMenu alloc] init];
  appMenuItem.submenu = appMenu;
  [appMenu addItemWithTitle:@"关于 风起 · 校园" action:@selector(orderFrontStandardAboutPanel:) keyEquivalent:@""];
  [appMenu addItem:[NSMenuItem separatorItem]];
  [appMenu addItemWithTitle:@"退出 风起 · 校园" action:@selector(terminate:) keyEquivalent:@"q"];

  NSMenuItem *sceneMenuItem = [[NSMenuItem alloc] init];
  [mainMenu addItem:sceneMenuItem];
  NSMenu *sceneMenu = [[NSMenu alloc] initWithTitle:@"场景与视图"];
  sceneMenuItem.submenu = sceneMenu;

  NSMenuItem *gameItem = [[NSMenuItem alloc] initWithTitle:@"校园探索 (主游戏)" action:@selector(openMainGame) keyEquivalent:@"1"];
  gameItem.target = self;
  [sceneMenu addItem:gameItem];

  NSMenuItem *charItem = [[NSMenuItem alloc] initWithTitle:@"角色动作工作室" action:@selector(openCharacterStudio) keyEquivalent:@"2"];
  charItem.target = self;
  [sceneMenu addItem:charItem];

  NSMenuItem *mapItem = [[NSMenuItem alloc] initWithTitle:@"开发区校区三维地图" action:@selector(openCampusMap) keyEquivalent:@"3"];
  mapItem.target = self;
  [sceneMenu addItem:mapItem];

  [sceneMenu addItem:[NSMenuItem separatorItem]];

  NSMenuItem *reloadItem = [[NSMenuItem alloc] initWithTitle:@"重新加载页面" action:@selector(reloadPage) keyEquivalent:@"r"];
  reloadItem.target = self;
  [sceneMenu addItem:reloadItem];

  NSMenuItem *browserItem = [[NSMenuItem alloc] initWithTitle:@"在默认浏览器中打开" action:@selector(openInBrowser) keyEquivalent:@"b"];
  browserItem.target = self;
  [sceneMenu addItem:browserItem];

  [sceneMenu addItem:[NSMenuItem separatorItem]];
  NSMenuItem *fullScreenItem = [[NSMenuItem alloc] initWithTitle:@"切换全屏" action:@selector(toggleFullScreen:) keyEquivalent:@"f"];
  fullScreenItem.keyEquivalentModifierMask = NSEventModifierFlagCommand | NSEventModifierFlagControl;
  [sceneMenu addItem:fullScreenItem];

  [NSApp setMainMenu:mainMenu];
}

- (void)openMainGame {
  [self setPointerLock:NO notifyJS:NO];
  NSURL *url = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%ld/", (long)self.port]];
  [self.webView loadRequest:[NSURLRequest requestWithURL:url]];
}

- (void)openCharacterStudio {
  [self setPointerLock:NO notifyJS:NO];
  NSURL *url = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%ld/character.html", (long)self.port]];
  [self.webView loadRequest:[NSURLRequest requestWithURL:url]];
}

- (void)openCampusMap {
  [self setPointerLock:NO notifyJS:NO];
  NSURL *url = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%ld/map.html", (long)self.port]];
  [self.webView loadRequest:[NSURLRequest requestWithURL:url]];
}

- (void)reloadPage {
  [self setPointerLock:NO notifyJS:NO];
  [self.webView reload];
}

- (void)openInBrowser {
  [self setPointerLock:NO notifyJS:YES];
  NSURL *url = self.webView.URL ?: [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%ld/", (long)self.port]];
  if (url) {
    [[NSWorkspace sharedWorkspace] openURL:url];
  }
}

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  [self startServerIfNeeded];
  [self setupMenus];

  WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
  WKUserContentController *controller = [[WKUserContentController alloc] init];
  [controller addScriptMessageHandler:self name:@"pointerLock"];

  NSString *js = @"(function() {"
    "window.__lockedCanvas = null;"
    "window.__onNativeMouseMove = function(dx, dy) {"
      "if (!window.__lockedCanvas) return;"
      "const evt = new MouseEvent('mousemove', { bubbles: true, cancelable: true, movementX: dx, movementY: dy });"
      "Object.defineProperty(evt, 'movementX', { value: dx });"
      "Object.defineProperty(evt, 'movementY', { value: dy });"
      "window.dispatchEvent(evt);"
    "};"
    "window.__onNativeKey = function(type, code, repeat) {"
      "const evt = new KeyboardEvent(type, { code: code, key: code, repeat: !!repeat, bubbles: true, cancelable: true });"
      "Object.defineProperty(evt, 'code', { value: code });"
      "Object.defineProperty(evt, 'repeat', { value: !!repeat });"
      "window.dispatchEvent(evt);"
    "};"
    "window.__onNativePointerLockChange = function(locked) {"
      "window.__lockedCanvas = locked ? (document.getElementById('scene') || document.querySelector('canvas')) : null;"
      "document.dispatchEvent(new Event('pointerlockchange'));"
    "};"
    "Object.defineProperty(Document.prototype, 'pointerLockElement', {"
      "configurable: true,"
      "get: function() { return window.__lockedCanvas; }"
    "});"
    "HTMLCanvasElement.prototype.requestPointerLock = function() {"
      "window.__lockedCanvas = this;"
      "if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.pointerLock) {"
        "window.webkit.messageHandlers.pointerLock.postMessage({ action: 'lock' });"
      "}"
      "setTimeout(function() { document.dispatchEvent(new Event('pointerlockchange')); }, 0);"
      "return Promise.resolve();"
    "};"
    "Document.prototype.exitPointerLock = function() {"
      "const wasLocked = !!window.__lockedCanvas;"
      "window.__lockedCanvas = null;"
      "if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.pointerLock) {"
        "window.webkit.messageHandlers.pointerLock.postMessage({ action: 'unlock' });"
      "}"
      "if (wasLocked) { document.dispatchEvent(new Event('pointerlockchange')); }"
    "};"
  "})();";

  WKUserScript *userScript = [[WKUserScript alloc] initWithSource:js injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:YES];
  [controller addUserScript:userScript];
  config.userContentController = controller;

  NSRect rect = NSMakeRect(0, 0, 1440, 900);
  NSWindowStyleMask style = NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable;
  self.window = [[NSWindow alloc] initWithContentRect:rect styleMask:style backing:NSBackingStoreBuffered defer:NO];
  self.window.title = @"风起 · 校园 | CAMPUS ECHO";
  [self.window center];
  self.window.delegate = self;
  self.window.collectionBehavior = NSWindowCollectionBehaviorFullScreenPrimary;
  self.window.backgroundColor = [NSColor colorWithCalibratedRed:0.14 green:0.25 blue:0.26 alpha:1.0];

  self.webView = [[WKWebView alloc] initWithFrame:rect configuration:config];
  self.webView.navigationDelegate = self;
  self.webView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
  self.window.contentView = self.webView;
  [self.window makeKeyAndOrderFront:nil];
  [self.window makeFirstResponder:self.webView];
  [NSApp activateIgnoringOtherApps:YES];

  __weak typeof(self) weakSelf = self;
  NSEventMask mask = NSEventMaskMouseMoved | NSEventMaskLeftMouseDragged | NSEventMaskRightMouseDragged | NSEventMaskOtherMouseDragged | NSEventMaskKeyDown | NSEventMaskKeyUp | NSEventMaskFlagsChanged;
  self.eventMonitor = [NSEvent addLocalMonitorForEventsMatchingMask:mask handler:^NSEvent * _Nullable(NSEvent * _Nonnull event) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return event;

    if (event.type == NSEventTypeKeyDown) {
      if ((event.modifierFlags & (NSEventModifierFlagCommand | NSEventModifierFlagControl)) != 0) {
        return event;
      }
      if (event.keyCode == 53 && strongSelf.isPointerLocked) {
        [strongSelf setPointerLock:NO notifyJS:YES];
      }
      NSString *code = KeyCodeToDOMCode(event.keyCode);
      if (code) {
        NSString *call = [NSString stringWithFormat:@"window.__onNativeKey && window.__onNativeKey('keydown', '%@', %@);", code, event.isARepeat ? @"true" : @"false"];
        [strongSelf.webView evaluateJavaScript:call completionHandler:nil];
        return nil;
      }
      return event;
    }

    if (event.type == NSEventTypeKeyUp) {
      NSString *code = KeyCodeToDOMCode(event.keyCode);
      if (code) {
        NSString *call = [NSString stringWithFormat:@"window.__onNativeKey && window.__onNativeKey('keyup', '%@', false);", code];
        [strongSelf.webView evaluateJavaScript:call completionHandler:nil];
        return nil;
      }
      return event;
    }

    if (event.type == NSEventTypeFlagsChanged) {
      if (event.keyCode == 56 || event.keyCode == 60) {
        BOOL shiftDown = (event.modifierFlags & NSEventModifierFlagShift) != 0;
        NSString *code = (event.keyCode == 60) ? @"ShiftRight" : @"ShiftLeft";
        NSString *type = shiftDown ? @"keydown" : @"keyup";
        NSString *call = [NSString stringWithFormat:@"window.__onNativeKey && window.__onNativeKey('%@', '%@', false);", type, code];
        [strongSelf.webView evaluateJavaScript:call completionHandler:nil];
      }
      return event;
    }

    if (event.type == NSEventTypeMouseMoved || event.type == NSEventTypeLeftMouseDragged || event.type == NSEventTypeRightMouseDragged || event.type == NSEventTypeOtherMouseDragged) {
      if (strongSelf.isPointerLocked) {
        CGFloat dx = event.deltaX;
        CGFloat dy = event.deltaY;
        if (dx != 0 || dy != 0) {
          NSString *call = [NSString stringWithFormat:@"window.__onNativeMouseMove(%f, %f);", dx, dy];
          [strongSelf.webView evaluateJavaScript:call completionHandler:nil];
        }
        return nil;
      }
    }

    return event;
  }];

  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.3 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    [self openMainGame];
  });
}

- (void)windowDidResignKey:(NSNotification *)notification {
  [self setPointerLock:NO notifyJS:YES];
}

- (void)applicationDidResignActive:(NSNotification *)notification {
  [self setPointerLock:NO notifyJS:YES];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
  return YES;
}

- (void)applicationWillTerminate:(NSNotification *)notification {
  [self setPointerLock:NO notifyJS:NO];
  if (self.serverTask && self.serverTask.isRunning) {
    [self.serverTask terminate];
  }
}

@end

int main(int argc, const char * argv[]) {
  setenv("NO_PROXY", "127.0.0.1,localhost", 1);
  setenv("no_proxy", "127.0.0.1,localhost", 1);
  @autoreleasepool {
    NSApplication *app = [NSApplication sharedApplication];
    [app setActivationPolicy:NSApplicationActivationPolicyRegular];
    AppDelegate *delegate = [[AppDelegate alloc] init];
    app.delegate = delegate;
    [app run];
  }
  return 0;
}
