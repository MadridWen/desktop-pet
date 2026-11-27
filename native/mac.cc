#include <ApplicationServices/ApplicationServices.h>
#include <CoreFoundation/CoreFoundation.h>
#include <IOKit/hidsystem/IOLLEvent.h>

#include <condition_variable>
#include <mutex>
#include <thread>

#include "input.h"
#include "keycodes.h"

namespace {
std::thread worker;
std::mutex startup_mutex;
std::condition_variable startup;
bool ready = false;
CFRunLoopRef loop = nullptr;
CFRunLoopSourceRef stop_source = nullptr;

bool ModifierPressed(uint8_t key, CGEventFlags flags) {
  switch (key) {
    case 57: return true;  // Caps Lock changes its latch state on either press.
    case 224: return flags & NX_DEVICELCTLKEYMASK;
    case 225: return flags & NX_DEVICELSHIFTKEYMASK;
    case 226: return flags & NX_DEVICELALTKEYMASK;
    case 227: return flags & NX_DEVICELCMDKEYMASK;
    case 228: return flags & NX_DEVICERCTLKEYMASK;
    case 229: return flags & NX_DEVICERSHIFTKEYMASK;
    case 230: return flags & NX_DEVICERALTKEYMASK;
    case 231: return flags & NX_DEVICERCMDKEYMASK;
    default: return false;
  }
}

CGEventRef ReadInput(CGEventTapProxy, CGEventType type, CGEventRef event, void* context) {
  switch (type) {
    case kCGEventTapDisabledByTimeout:
    case kCGEventTapDisabledByUserInput:
      CGEventTapEnable(*static_cast<CFMachPortRef*>(context), true);
      if (!CGEventTapIsEnabled(*static_cast<CFMachPortRef*>(context))) {
        CFRunLoopStop(CFRunLoopGetCurrent());
      }
      break;
    case kCGEventKeyDown:
    case kCGEventFlagsChanged: {
      const auto key = input::MacKey(CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode));
      if (key && (type == kCGEventKeyDown || ModifierPressed(key, CGEventGetFlags(event)))) {
        input::pressed_key.store(key);
      }
      break;
    }
    case kCGEventLeftMouseDown: input::clicks.fetch_or(input::Primary); break;
    case kCGEventRightMouseDown: input::clicks.fetch_or(input::Secondary); break;
    case kCGEventOtherMouseDown: input::clicks.fetch_or(input::Other); break;
    case kCGEventScrollWheel: {
      auto delta = CGEventGetIntegerValueField(event, kCGScrollWheelEventDeltaAxis1);
      if (!delta) delta = CGEventGetIntegerValueField(event, kCGScrollWheelEventDeltaAxis2);
      if (delta) input::scroll.fetch_or(delta > 0 ? input::Up : input::Down);
      break;
    }
    default: break;
  }
  return event;
}

void Run() {
  const CGEventMask mask = CGEventMaskBit(kCGEventKeyDown) |
      CGEventMaskBit(kCGEventFlagsChanged) | CGEventMaskBit(kCGEventLeftMouseDown) |
      CGEventMaskBit(kCGEventRightMouseDown) | CGEventMaskBit(kCGEventOtherMouseDown) |
      CGEventMaskBit(kCGEventScrollWheel);
  CFMachPortRef tap = CGEventTapCreate(kCGSessionEventTap, kCGHeadInsertEventTap,
      kCGEventTapOptionListenOnly, mask, ReadInput, &tap);
  CFRunLoopSourceRef source = tap ? CFMachPortCreateRunLoopSource(nullptr, tap, 0) : nullptr;
  CFRunLoopSourceContext stop_context{};
  stop_context.perform = [](void*) { CFRunLoopStop(CFRunLoopGetCurrent()); };
  if (source) stop_source = CFRunLoopSourceCreate(nullptr, 0, &stop_context);
  const bool started = source && stop_source;
  if (started) {
    loop = CFRunLoopGetCurrent();
    CFRetain(loop);
    CFRunLoopAddSource(loop, source, kCFRunLoopCommonModes);
    CFRunLoopAddSource(loop, stop_source, kCFRunLoopCommonModes);
    CGEventTapEnable(tap, true);
  }
  {
    std::lock_guard<std::mutex> lock(startup_mutex);
    input::active.store(started);
    ready = true;
  }
  startup.notify_one();
  if (started) {
    CFRunLoopRun();
    input::active.store(false);
    CFRunLoopRemoveSource(loop, stop_source, kCFRunLoopCommonModes);
    CFRunLoopRemoveSource(loop, source, kCFRunLoopCommonModes);
  }
  if (source) CFRelease(source);
  if (tap) {
    CFMachPortInvalidate(tap);
    CFRelease(tap);
  }
}
}  // namespace

namespace input {
bool HasPermission() { return CGPreflightListenEventAccess(); }
bool RequestPermission() { return CGRequestListenEventAccess(); }

bool Start() {
  if (active.load()) return true;
  Stop();
  if (!HasPermission()) return false;
  std::unique_lock<std::mutex> lock(startup_mutex);
  ready = false;
  worker = std::thread(Run);
  startup.wait(lock, [] { return ready; });
  return active.load();
}

void Stop() {
  if (!worker.joinable()) return;
  if (active.load()) {
    CFRunLoopSourceSignal(stop_source);
    CFRunLoopWakeUp(loop);
  }
  worker.join();
  if (stop_source) CFRelease(stop_source);
  if (loop) CFRelease(loop);
  stop_source = nullptr;
  loop = nullptr;
}
}  // namespace input
