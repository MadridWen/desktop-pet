#include <ApplicationServices/ApplicationServices.h>
#include <CoreFoundation/CoreFoundation.h>

#include <condition_variable>
#include <mutex>
#include <thread>

#include "input.h"

namespace {
std::thread worker;
std::mutex startup_mutex;
std::condition_variable startup;
bool ready = false;
CFRunLoopRef loop = nullptr;
CFRunLoopSourceRef stop_source = nullptr;

uint32_t Zone(int64_t code) {
  switch (code) {
    // ANSI physical positions in the left and center of the keyboard.
    case 0: case 1: case 2: case 3: case 5: case 6: case 7: case 8: case 9:
    case 12: case 13: case 14: case 15: case 17: case 18: case 19: case 20:
    case 21: case 23: case 48: case 56: case 57: return input::Left;
    case 4: case 11: case 16: case 22: case 25: case 26: case 32: case 34:
    case 38: case 40: case 45: case 46: return input::Middle;
    case 49: return input::Space;
    default: return input::Right;
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
      input::keys.fetch_or(Zone(CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode)));
      break;
    case kCGEventFlagsChanged:
      input::keys.fetch_or(Zone(CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode)));
      break;
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
