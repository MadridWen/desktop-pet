#pragma once

#include <atomic>
#include <cstdint>

namespace input {
enum MouseButton : uint32_t { Primary = 1, Secondary = 2, Other = 4 };
enum Scroll : uint32_t { Up = 1, Down = 2 };

extern std::atomic<uint32_t> pressed_key;
extern std::atomic<uint32_t> clicks;
extern std::atomic<uint32_t> scroll;
extern std::atomic<bool> active;

bool HasPermission();
bool RequestPermission();
bool Start();
void Stop();
}  // namespace input
