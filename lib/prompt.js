'use strict';
const readline = require('readline');

// items: [{ name, label?, checked }]. Resolves to the selected `name`s. Arrow keys,
// space, enter (and `a` to toggle all) in a real terminal; a numbered question when
// stdin is not a TTY (piped input, CI, scripts), where raw-mode keys cannot work.
function checkboxPrompt(message, items) {
  if (!process.stdin.isTTY) return fallbackPrompt(message, items);

  return new Promise((resolve) => {
    const state = items.map((i) => ({ ...i }));
    let cursor = 0;
    let linesPrinted = 0;

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    function render() {
      if (linesPrinted > 0) process.stdout.write(`\x1b[${linesPrinted}A`);
      const lines = [
        `${message}`,
        `  (up/down move, space toggle, a all, enter confirm, esc cancel)`,
        ...state.map((item, i) => `${i === cursor ? '>' : ' '} [${item.checked ? 'x' : ' '}] ${item.label || item.name}`),
      ];
      for (const line of lines) process.stdout.write(`\x1b[2K${line}\n`);
      linesPrinted = lines.length;
    }

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('keypress', onKeypress);
    }

    function onKeypress(str, key) {
      if (key.name === 'up' || key.name === 'k') cursor = (cursor - 1 + state.length) % state.length;
      else if (key.name === 'down' || key.name === 'j') cursor = (cursor + 1) % state.length;
      else if (key.name === 'space') state[cursor].checked = !state[cursor].checked;
      else if (str === 'a') {
        const allOn = state.every((i) => i.checked);
        for (const i of state) i.checked = !allOn;
      } else if (key.name === 'return') {
        cleanup();
        resolve(state.filter((i) => i.checked).map((i) => i.name));
        return;
      } else if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        cleanup();
        console.log('\nCancelled.');
        process.exit(1);
      }
      render();
    }

    process.stdin.on('keypress', onKeypress);
    render();
  });
}

function fallbackPrompt(message, items) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(message);
    items.forEach((item, i) => console.log(`  [${i + 1}] ${item.label || item.name}${item.checked ? '  (currently on)' : ''}`));
    rl.question('Numbers separated by commas, "all", or "none": ', (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === 'all') return resolve(items.map((i) => i.name));
      if (trimmed === '' || trimmed === 'none') return resolve([]);
      const indices = trimmed.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n));
      resolve(indices.map((n) => items[n - 1]).filter(Boolean).map((i) => i.name));
    });
  });
}

module.exports = { checkboxPrompt };
