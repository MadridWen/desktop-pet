#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <condition_variable>
#include <mutex>
#include <thread>

#include "input.h"

namespace {
std::thread worker;
std::mutex startup_mutex;
std::condition_variable startup;
bool ready = false;
DWORD thread_id = 0;

uint32_t Zone(const RAWKEYBOARD& key) {
  if (key.Flags & (RI_KEY_E0 | RI_KEY_E1)) return input::Right;
  const auto code = key.MakeCode;
  if (code == 0x39) return input::Space;
  if ((code >= 0x02 && code <= 0x06) || (code >= 0x10 && code <= 0x14) ||
      (code >= 0x1e && code <= 0x22) || (code >= 0x2c && code <= 0x2f) ||
      code == 0x0f || code == 0x2a || code == 0x3a) return input::Left;
  if ((code >= 0x07 && code <= 0x09) || (code >= 0x15 && code <= 0x17) ||
      (code >= 0x23 && code <= 0x25) || (code >= 0x30 && code <= 0x32)) {
    return input::Middle;
  }
  return input::Right;
}

void ReadInput(HRAWINPUT handle) {
  RAWINPUT data{};
  UINT size = sizeof(data);
  if (GetRawInputData(handle, RID_INPUT, &data, &size, sizeof(RAWINPUTHEADER)) ==
      static_cast<UINT>(-1)) return;

  if (data.header.dwType == RIM_TYPEKEYBOARD) {
    if (!(data.data.keyboard.Flags & RI_KEY_BREAK) && data.data.keyboard.VKey != 0xff) {
      input::keys.fetch_or(Zone(data.data.keyboard));
    }
  } else if (data.header.dwType == RIM_TYPEMOUSE) {
    const auto flags = data.data.mouse.usButtonFlags;
    if (flags & RI_MOUSE_LEFT_BUTTON_DOWN) input::clicks.fetch_or(input::Primary);
    if (flags & RI_MOUSE_RIGHT_BUTTON_DOWN) input::clicks.fetch_or(input::Secondary);
    if (flags & (RI_MOUSE_MIDDLE_BUTTON_DOWN | RI_MOUSE_BUTTON_4_DOWN |
                 RI_MOUSE_BUTTON_5_DOWN)) input::clicks.fetch_or(input::Other);
    if (flags & (RI_MOUSE_WHEEL | RI_MOUSE_HWHEEL)) {
      input::scroll.fetch_or(static_cast<SHORT>(data.data.mouse.usButtonData) > 0
                                 ? input::Up : input::Down);
    }
  }
}

LRESULT CALLBACK WindowProc(HWND window, UINT message, WPARAM wparam, LPARAM lparam) {
  if (message == WM_INPUT) ReadInput(reinterpret_cast<HRAWINPUT>(lparam));
  return DefWindowProcW(window, message, wparam, lparam);
}

void Run() {
  const auto module = GetModuleHandleW(nullptr);
  const wchar_t* class_name = L"BlossomDeskPetRawInput";
  WNDCLASSW window_class{};
  window_class.lpfnWndProc = WindowProc;
  window_class.hInstance = module;
  window_class.lpszClassName = class_name;
  const ATOM registered = RegisterClassW(&window_class);
  const HWND window = registered ? CreateWindowExW(
      0, class_name, L"", 0, 0, 0, 0, 0, HWND_MESSAGE, nullptr, module, nullptr) : nullptr;
  const RAWINPUTDEVICE devices[] = {
      {0x01, 0x02, RIDEV_INPUTSINK, window},
      {0x01, 0x06, RIDEV_INPUTSINK, window},
  };
  const bool started = window && RegisterRawInputDevices(devices, 2, sizeof(devices[0]));
  {
    std::lock_guard<std::mutex> lock(startup_mutex);
    thread_id = GetCurrentThreadId();
    input::active.store(started);
    ready = true;
  }
  startup.notify_one();

  if (started) {
    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0) > 0) DispatchMessageW(&msg);
    const RAWINPUTDEVICE remove[] = {
        {0x01, 0x02, RIDEV_REMOVE, nullptr},
        {0x01, 0x06, RIDEV_REMOVE, nullptr},
    };
    RegisterRawInputDevices(remove, 2, sizeof(remove[0]));
  }
  input::active.store(false);
  if (window) DestroyWindow(window);
  if (registered) UnregisterClassW(class_name, module);
}
}  // namespace

namespace input {
bool HasPermission() { return true; }
bool RequestPermission() { return true; }

bool Start() {
  if (active.load()) return true;
  if (worker.joinable()) worker.join();
  std::unique_lock<std::mutex> lock(startup_mutex);
  ready = false;
  worker = std::thread(Run);
  startup.wait(lock, [] { return ready; });
  return active.load();
}

void Stop() {
  if (!worker.joinable()) return;
  if (active.load()) PostThreadMessageW(thread_id, WM_QUIT, 0, 0);
  worker.join();
}
}  // namespace input
