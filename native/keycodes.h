#pragma once

#include <array>
#include <cstdint>
#include <cstddef>

namespace input {
// Keyboard/Keypad USB HID usages identify physical keys, independent of text layout.
inline constexpr std::array<uint8_t, 0x59> windows_keys = {
    // Scan set 1, no prefix.
    0, 41, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 45, 46, 42, 43,  // 00–0F
    20, 26, 8, 21, 23, 28, 24, 12, 18, 19, 47, 48, 40, 224, 4, 22,  // 10–1F
    7, 9, 10, 11, 13, 14, 15, 51, 52, 53, 225, 49, 29, 27, 6, 25,   // 20–2F
    5, 17, 16, 54, 55, 56, 229, 85, 226, 44, 57, 58, 59, 60, 61, 62, // 30–3F
    63, 64, 65, 66, 67, 83, 71, 95, 96, 97, 86, 92, 93, 94, 87, 89,  // 40–4F
    90, 91, 98, 99, 70, 0, 0, 68, 69                              // 50–58
};

inline constexpr uint8_t WindowsKey(uint16_t scan, bool extended) {
  if (!extended) return scan < windows_keys.size() ? windows_keys[scan] : 0;
  switch (scan) {
    case 0x1c: return 88;   // Keypad Enter
    case 0x1d: return 228;  // Right Control
    case 0x35: return 84;   // Keypad Divide
    case 0x37: return 70;   // Print Screen
    case 0x38: return 230;  // Right Alt
    case 0x45: return 83;   // Num Lock
    case 0x46: return 72;   // Pause / Break
    case 0x47: return 74;   // Home
    case 0x48: return 82;   // Up Arrow
    case 0x49: return 75;   // Page Up
    case 0x4b: return 80;   // Left Arrow
    case 0x4d: return 79;   // Right Arrow
    case 0x4f: return 77;   // End
    case 0x50: return 81;   // Down Arrow
    case 0x51: return 78;   // Page Down
    case 0x52: return 73;   // Insert
    case 0x53: return 76;   // Delete
    case 0x5b: return 227;  // Left GUI
    case 0x5c: return 231;  // Right GUI
    case 0x5d: return 101;  // Application / Menu
    default: return 0;
  }
}

inline constexpr std::array<uint8_t, 0x7f> mac_keys = {
    // macOS ANSI virtual key positions from HIToolbox.
    4, 22, 7, 9, 11, 10, 29, 27, 6, 25, 0, 5, 20, 26, 8, 21,          // 00–0F
    28, 23, 30, 31, 32, 33, 35, 34, 46, 38, 36, 45, 37, 39, 48, 18,    // 10–1F
    24, 47, 12, 19, 40, 15, 13, 52, 14, 51, 49, 54, 56, 17, 16, 55,    // 20–2F
    43, 44, 53, 42, 0, 41, 231, 227, 225, 57, 226, 224, 229, 230, 228, 0, // 30–3F
    0, 99, 0, 85, 0, 87, 0, 83, 0, 0, 0, 84, 88, 0, 86, 0,           // 40–4F
    0, 0, 98, 89, 90, 91, 92, 93, 94, 95, 0, 96, 97, 0, 0, 0,           // 50–5F
    62, 63, 64, 60, 65, 66, 0, 68, 0, 70, 0, 71, 0, 67, 101, 69,      // 60–6F
    0, 72, 73, 74, 75, 76, 61, 77, 59, 78, 58, 80, 79, 81, 82          // 70–7E
};

inline constexpr uint8_t MacKey(int64_t code) {
  return code >= 0 && code < static_cast<int64_t>(mac_keys.size())
      ? mac_keys[static_cast<std::size_t>(code)] : 0;
}
}  // namespace input
