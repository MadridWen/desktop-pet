'use strict';

// Physical key IDs follow the Keyboard/Keypad USB HID usage table.
const typingRows = [
  [
    [41, 'Esc'], [0, '', 1],
    [58, 'F1'], [59, 'F2'], [60, 'F3'], [61, 'F4'], [0, '', .5],
    [62, 'F5'], [63, 'F6'], [64, 'F7'], [65, 'F8'], [0, '', .5],
    [66, 'F9'], [67, 'F10'], [68, 'F11'], [69, 'F12']
  ],
  [
    [53, '`'], [30, '1'], [31, '2'], [32, '3'], [33, '4'], [34, '5'], [35, '6'],
    [36, '7'], [37, '8'], [38, '9'], [39, '0'], [45, '-'], [46, '='], [42, '⌫', 2]
  ],
  [
    [43, 'Tab', 1.5], [20, 'Q'], [26, 'W'], [8, 'E'], [21, 'R'], [23, 'T'],
    [28, 'Y'], [24, 'U'], [12, 'I'], [18, 'O'], [19, 'P'], [47, '['], [48, ']'], [49, '\\', 1.5]
  ],
  [
    [57, 'Caps', 1.75], [4, 'A'], [22, 'S'], [7, 'D'], [9, 'F'], [10, 'G'],
    [11, 'H'], [13, 'J'], [14, 'K'], [15, 'L'], [51, ';'], [52, "'"], [40, 'Enter', 2.25]
  ],
  [
    [225, 'Shift', 2.25], [29, 'Z'], [27, 'X'], [6, 'C'], [25, 'V'], [5, 'B'],
    [17, 'N'], [16, 'M'], [54, ','], [55, '.'], [56, '/'], [229, 'Shift', 2.75]
  ],
  [
    [224, 'Ctrl', 1.25], [227, 'Win', 1.25], [226, 'Alt', 1.25], [44, 'Space', 6.25],
    [230, 'Alt', 1.25], [231, 'Win', 1.25], [101, 'Menu', 1.25], [228, 'Ctrl', 1.25]
  ]
];

const navigationRows = [
  [[70, 'PrtSc'], [71, 'ScrLk'], [72, 'Pause']],
  [[73, 'Ins'], [74, 'Home'], [75, 'PgUp']],
  [[76, 'Del'], [77, 'End'], [78, 'PgDn']],
  [],
  [[0, ''], [82, '↑']],
  [[80, '←'], [81, '↓'], [79, '→']]
];

const numberPadKeys = [
  [83, 'Num'], [84, '/'], [85, '*'], [86, '-'],
  [95, '7'], [96, '8'], [97, '9'], [87, '+', 1, 2],
  [92, '4'], [93, '5'], [94, '6'],
  [89, '1'], [90, '2'], [91, '3'], [88, '↵', 1, 2],
  [98, '0', 2], [99, '.']
];

function createDeskKeyboard(container) {
  const keys = new Map();

  function makeKey(id, legend) {
    const key = document.createElement('span');
    key.className = id ? 'key' : 'keyboard-gap';
    if (id) {
      key.dataset.key = id;
      key.textContent = legend;
      if (legend.length > 2) key.classList.add('key-long');
      keys.set(id, key);
    }
    return key;
  }

  for (const [kind, rows, columnsPerUnit] of [
    ['typing', typingRows, 4],
    ['navigation', navigationRows, 1]
  ]) {
    const bank = document.createElement('div');
    bank.className = 'keyboard-bank keyboard-' + kind;
    for (const entries of rows) {
      const row = document.createElement('div');
      row.className = 'keyboard-row';
      for (const [id, legend, units = 1] of entries) {
        const key = makeKey(id, legend);
        key.style.gridColumn = 'span ' + units * columnsPerUnit;
        row.append(key);
      }
      bank.append(row);
    }
    container.append(bank);
  }

  const numberPad = document.createElement('div');
  numberPad.className = 'keyboard-number-pad';
  for (const [id, legend, columns = 1, rows = 1] of numberPadKeys) {
    const key = makeKey(id, legend);
    key.style.gridColumn = 'span ' + columns;
    key.style.gridRow = 'span ' + rows;
    numberPad.append(key);
  }
  container.append(numberPad);
  return keys;
}
