'use strict';

const qwertyRows = [
  [
    ['Esc', ['', 1], 'F1', 'F2', 'F3', 'F4', ['', 0.5]],
    ['F5', 'F6', 'F7', 'F8', ['', 0.5]],
    ['F9', 'F10', 'F11', 'F12']
  ],
  [
    ['`', '1', '2', '3', '4', '5'],
    ['6', '7', '8'],
    ['9', '0', '-', '=', ['⌫', 2]]
  ],
  [
    [['Tab', 1.5], 'Q', 'W', 'E', 'R', 'T'],
    ['Y', 'U', 'I'],
    ['O', 'P', '[', ']', ['\\', 1.5]]
  ],
  [
    [['Caps', 1.75], 'A', 'S', 'D', 'F', 'G'],
    ['H', 'J', 'K'],
    ['L', ';', "'", ['Enter', 2.25]]
  ],
  [
    [['Shift', 2.25], 'Z', 'X', 'C', 'V'],
    ['B', 'N', 'M'],
    [',', '.', '/', ['Shift', 2.75]]
  ],
  [
    [['Ctrl', 1.25], ['Win', 1.25], ['Alt', 1.25]],
    [['Space', 6.25]],
    [['Alt', 1.25], ['Win', 1.25], ['Menu', 1.25], ['Ctrl', 1.25]]
  ]
];

const navigationRows = [
  ['PrtSc', 'ScrLk', 'Pause'],
  ['Ins', 'Home', 'PgUp'],
  ['Del', 'End', 'PgDn'],
  [],
  ['', '↑'],
  ['←', '↓', '→']
];

const numberPadKeys = [
  'Num', '/', '*', '-',
  '7', '8', '9', ['+', 1, 2],
  '4', '5', '6',
  '1', '2', '3', ['↵', 1, 2],
  ['0', 2, 1], '.'
];

function createKey(legend, zone) {
  const key = document.createElement('span');
  key.className = legend ? 'key zone-' + zone : 'keyboard-gap';
  if (legend.length > 2) key.classList.add('key-long');
  key.textContent = legend;
  return key;
}

function appendKeyboardRows(parent, rows, fillRow) {
  for (const entries of rows) {
    const row = document.createElement('div');
    row.className = 'keyboard-row';
    fillRow(row, entries);
    parent.append(row);
  }
}

function createDeskKeyboard(container) {
  const typing = document.createElement('div');
  typing.className = 'keyboard-bank keyboard-typing';
  appendKeyboardRows(typing, qwertyRows, (row, groups) => {
    groups.forEach((entries, group) => {
      for (const entry of entries) {
        const [legend, units] = typeof entry === 'string' ? [entry, 1] : entry;
        const key = createKey(legend, legend === 'Space' ? 8 : 1 << group);
        key.style.gridColumn = 'span ' + units * 4;
        row.append(key);
      }
    });
  });

  const navigation = document.createElement('div');
  navigation.className = 'keyboard-bank keyboard-navigation';
  appendKeyboardRows(navigation, navigationRows, (row, legends) => {
    for (const legend of legends) row.append(createKey(legend, 4));
  });

  const numberPad = document.createElement('div');
  numberPad.className = 'keyboard-number-pad';
  for (const entry of numberPadKeys) {
    const [legend, columns, rows] = typeof entry === 'string' ? [entry, 1, 1] : entry;
    const key = createKey(legend, 4);
    key.style.gridColumn = 'span ' + columns;
    key.style.gridRow = 'span ' + rows;
    numberPad.append(key);
  }

  container.append(typing, navigation, numberPad);
}
