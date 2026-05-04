#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const args = process.argv.slice(2);
const command = args[0];
const sourceDir = path.join(__dirname, '..');
const packageJson = require(path.join(sourceDir, 'package.json'));
const useColor = !process.env.NO_COLOR && process.env.FORCE_COLOR !== '0' && process.env.TERM !== 'dumb';

const ansi = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  darkGreen: '\x1b[38;5;28m',
  mint: '\x1b[38;5;121m',
  dotMint: '\x1b[38;5;86m',
  teal: '\x1b[38;5;43m',
  cyan: '\x1b[38;5;80m',
  gray: '\x1b[90m',
  red: '\x1b[31m'
};

const color = (value, code) => (useColor ? `${code}${value}${ansi.reset}` : value);
const accent = value => color(value, ansi.mint);
const muted = value => color(value, ansi.gray);
const danger = value => color(value, ansi.red);
const success = message => console.log(`${accent('✓')} ${message}`);
const selectionTitle = value => {
  console.log(color(value, ansi.bold + ansi.mint));
  console.log(muted('-'.repeat(value.length)));
};
const selectionOption = (value, label) => {
  console.log(`  ${color(String(value).padStart(2), ansi.bold + ansi.mint)}  ${label}`);
};
const selectionPrompt = (value, fallback, hint) => {
  const plainInputLine = `> ${value} [${fallback}]: `;
  const inputLine = `\n${color('>', ansi.bold + ansi.mint)} ${color(value, ansi.bold)} ${muted(`[${fallback}]`)}: `;
  if (!hint || !process.stdout.isTTY) {
    return { text: inputLine, hintLineCount: 0 };
  }
  return {
    text: `${inputLine}\n  ${muted(hint)}\x1b[1A\r\x1b[${plainInputLine.length}C`,
    hintLineCount: 1
  };
};

const bannerShape = [
  '##   ##  ####  ######  #####  ###### #####   #### ',
  '### ### ##  ## ##     ##        ##   ##  ## ##  ##',
  '## # ## ###### #####   ####     ##   #####  ##  ##',
  '##   ## ##  ## ##         ##    ##   ##  ## ##  ##',
  '##   ## ##  ## ###### #####     ##   ##  ##  #### '
];

const buildBannerLines = () => {
  const shapeWidth = Math.max(...bannerShape.map(line => line.length));
  const shapeHeight = bannerShape.length;
  const width = shapeWidth + 5;
  const height = shapeHeight + 4;
  const canvas = Array.from({ length: height }, () => Array(width).fill(' '));
  const set = (row, column, value) => {
    if (row >= 0 && row < height && column >= 0 && column < width && canvas[row][column] === ' ') {
      canvas[row][column] = value;
    }
  };
  const paddedShape = bannerShape.map(line => line.padEnd(shapeWidth, ' '));
  const outside = Array.from({ length: shapeHeight + 2 }, () => Array(shapeWidth + 2).fill(false));
  const queue = [[0, 0]];
  outside[0][0] = true;

  for (let index = 0; index < queue.length; index++) {
    const [row, column] = queue[index];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([rowOffset, columnOffset]) => {
      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;
      if (
        nextRow < 0 ||
        nextRow >= outside.length ||
        nextColumn < 0 ||
        nextColumn >= outside[0].length ||
        outside[nextRow][nextColumn]
      ) {
        return;
      }

      const shapeRow = nextRow - 1;
      const shapeColumn = nextColumn - 1;
      if (paddedShape[shapeRow] && paddedShape[shapeRow][shapeColumn] === '#') return;
      outside[nextRow][nextColumn] = true;
      queue.push([nextRow, nextColumn]);
    });
  }

  const isOutsideShape = (row, column) => outside[row + 1] && outside[row + 1][column + 1];

  bannerShape.forEach((line, row) => {
    [...line].forEach((char, column) => {
      if (char !== '#') return;
      if (isOutsideShape(row, column + 1)) set(row + 2, column + 3, '*');
      if (isOutsideShape(row + 1, column)) set(row + 3, column + 2, '*');
    });
  });

  bannerShape.forEach((line, row) => {
    [...line].forEach((char, column) => {
      if (char === '#') canvas[row + 2][column + 2] = '#';
    });
  });

  const dotCells = [];

  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      if (canvas[row][column] === ' ' && (row * 7 + column) % 97 === 0) {
        dotCells.push([row, column]);
      } else if (
        canvas[row][column] === ' ' &&
        ((row * 11 + column * 3) % 41 === 0 || (row * 13 + column) % 29 === 0)
      ) {
        dotCells.push([row, column]);
      }
    }
  }

  dotCells.forEach(([row, column], index) => {
    canvas[row][column] = index % 2 === 0 ? '.' : ',';
  });

  return canvas.map(row => row.join('').trimEnd());
};

const renderBannerLine = line => [...line].map(char => {
  if (char === '#') return color('█', ansi.green);
  if (char === '*') return color('░', ansi.darkGreen);
  if (char === ':') return color('░', ansi.darkGreen);
  if (char === '.') return color('·', ansi.bold + ansi.dotMint);
  if (char === ',') return color('·', ansi.bold + ansi.green);
  return ' ';
}).join('');

const clearTerminal = () => {
  console.clear();
  process.stdout.write('\x1bc\x1b[3J\x1b[2J\x1b[H');
};

const printHeader = () => {
  buildBannerLines().forEach(line => {
    console.log(renderBannerLine(line));
  });
  console.log('');
  console.log(`${color('Maestro', ansi.bold + ansi.mint)} ${muted(`v${packageJson.version}`)}`);
  console.log('Dynamic skill orchestrator for AI coding assistants.');
};

const getSummaryLines = state => {
  const lines = [];
  if (state.action) {
    lines.push(`Action: ${state.action === 'uninstall' ? 'Uninstallation' : 'Installation'}`);
  }
  if (typeof state.isGlobal === 'boolean') {
    lines.push(`Scope: ${state.isGlobal ? 'Global user folder' : 'Local project'}`);
  }
  if (state.selectedEnvs) {
    lines.push(`AI environment: ${state.selectedEnvs.map(env => envs[env].label).join(', ')}`);
  }
  return lines;
};

const renderInstallScreen = (state, renderSelection, errorMessage) => {
  clearTerminal();
  printHeader();

  const summaryLines = getSummaryLines(state);
  if (summaryLines.length > 0) {
    console.log('');
    console.log(accent('Selected options'));
    summaryLines.forEach(line => console.log(line));
  }

  console.log('');
  renderSelection();

  if (errorMessage) {
    console.log(danger(errorMessage));
  }
};

if (args.some(arg => arg.startsWith('--'))) {
  console.log(danger('Flags are no longer used. Run: npx @alissonpokry/maestro init'));
  process.exit(1);
}

if (command && command !== 'init' && command !== 'uninstall') {
  console.log(danger('Usage: npx @alissonpokry/maestro <init|uninstall>'));
  process.exit(1);
}

const envs = {
  cursor: { label: 'Cursor', dir: '.cursor', file: null, skillsDir: '.cursor/skills' },
  claude: { label: 'Claude', dir: '.claude', file: 'CLAUDE.md', skillsDir: '.claude/skills' },
  antigravity: { label: 'Antigravity', dir: '.gemini', file: 'GEMINI.md', skillsDir: path.join('.gemini', 'antigravity', 'skills') },
  codex: { label: 'Codex / Agents', dir: '.agents', file: 'AGENTS.md', skillsDir: path.join('.agents', 'skills') }
};

const envOrder = Object.keys(envs);
const coreSkills = ['maestro', 'maestro-fetch', 'maestro-stats', 'maestro-set'];

let fallbackReadline = null;
let fallbackClosed = false;
const fallbackAnswerQueue = [];
const fallbackWaiters = [];

const ensureFallbackReadline = () => {
  if (fallbackReadline) return;

  fallbackReadline = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: Boolean(process.stdout.isTTY)
  });

  fallbackReadline.on('line', line => {
    const waiter = fallbackWaiters.shift();
    if (waiter) {
      waiter(line);
      return;
    }
    fallbackAnswerQueue.push(line);
  });

  fallbackReadline.once('close', () => {
    fallbackClosed = true;
    while (fallbackWaiters.length > 0) {
      fallbackWaiters.shift()('');
    }
  });
};

const askWithReadline = prompt => {
  ensureFallbackReadline();
  process.stdout.write(prompt.text);

  if (fallbackAnswerQueue.length > 0) {
    return Promise.resolve((fallbackAnswerQueue.shift() || '').trim());
  }
  if (fallbackClosed) {
    process.stdout.write('\n');
    return Promise.resolve('');
  }

  return new Promise(resolve => {
    fallbackWaiters.push(answer => resolve((answer || '').trim()));
  });
};

const ask = question => {
  const prompt = typeof question === 'string' ? { text: question, hintLineCount: 0 } : question;

  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return askWithReadline(prompt);
  }

  return new Promise(resolve => {
    let answer = '';
    let isDone = false;
    const wasRaw = process.stdin.isRaw;

    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
    };

    const finish = () => {
      if (isDone) return;
      isDone = true;
      cleanup();
      process.stdout.write(prompt.hintLineCount > 0 ? `\x1b[${prompt.hintLineCount}B\r\n` : '\n');
      resolve(answer.trim());
    };

    const eraseInputChar = () => {
      if (answer.length === 0) return;
      answer = answer.slice(0, -1);
      process.stdout.write('\b \b');
    };

    const onData = chunk => {
      if (isDone) return;
      [...chunk.toString('utf8')].forEach(char => {
        if (isDone) return;
        if (char === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          process.exit(130);
        }
        if (char === '\r' || char === '\n') {
          finish();
          return;
        }
        if (char === '\u007f' || char === '\b') {
          eraseInputChar();
          return;
        }
        if (char >= ' ' && char !== '\u007f') {
          answer += char;
          process.stdout.write(char);
        }
      });
    };

    process.stdout.write(prompt.text);
    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
};

const closePrompt = () => {
  if (fallbackReadline) {
    fallbackReadline.close();
    fallbackReadline = null;
  }
  if (!process.stdin.isTTY) return;
  process.stdin.setRawMode(false);
  process.stdin.pause();
};

const renderActionSelection = () => {
  selectionTitle('Setup action');
  selectionOption(1, 'Installation');
  selectionOption(2, 'Uninstallation');
};

const askAction = async state => {
  let errorMessage = null;
  while (true) {
    renderInstallScreen(state, renderActionSelection, errorMessage);
    const answer = (await ask(selectionPrompt('Choose action', '1'))).toLowerCase();
    if (!answer || answer === '1' || answer === 'install' || answer === 'installation' || answer === 'init') return 'init';
    if (answer === '2' || answer === 'uninstall' || answer === 'uninstallation' || answer === 'remove') return 'uninstall';
    errorMessage = 'Enter 1/install or 2/uninstall.';
  }
};

const renderScopeSelection = () => {
  selectionTitle('Install scope');
  selectionOption(1, 'Local project');
  selectionOption(2, 'Global user folder');
};

const askScope = async state => {
  let errorMessage = null;
  while (true) {
    renderInstallScreen(state, renderScopeSelection, errorMessage);
    const answer = (await ask(selectionPrompt('Choose scope', '1'))).toLowerCase();
    if (!answer || answer === '1' || answer === 'local' || answer === 'project') return false;
    if (answer === '2' || answer === 'global') return true;
    errorMessage = 'Enter 1/local or 2/global.';
  }
};

const renderEnvSelection = () => {
  selectionTitle('AI environment');
  envOrder.forEach((env, index) => {
    selectionOption(index + 1, envs[env].label);
  });
  selectionOption(envOrder.length + 1, 'All');
};

const askEnvs = async state => {
  let errorMessage = null;
  while (true) {
    renderInstallScreen(state, renderEnvSelection, errorMessage);
    const answer = (await ask(selectionPrompt(
      'Choose one or more, space-separated',
      'all',
      'Examples: 1 4  |  antigravity codex  |  all'
    ))).toLowerCase();
    if (!answer || answer === 'all' || answer === String(envOrder.length + 1)) return envOrder;

    const selected = answer
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(item => {
        const index = Number(item);
        if (Number.isInteger(index) && index >= 1 && index <= envOrder.length) return envOrder[index - 1];
        if (item === 'agents') return 'codex';
        return envOrder.find(env => env === item || envs[env].label.toLowerCase().includes(item));
      })
      .filter(Boolean);

    const unique = [...new Set(selected)];
    if (unique.length > 0) return unique;
    errorMessage = 'Enter names like antigravity,codex or numbers like 3,4.';
  }
};

const copyRecursiveSync = (src, dest) => {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
};

const uninstall = (selectedEnvs, isGlobal, targetBaseDir) => {
  selectedEnvs.forEach(env => {
    const envConfig = envs[env];
    const fileName = envConfig.file;

    if (fileName) {
      const destFile = path.join(targetBaseDir, fileName);
      if (fs.existsSync(destFile)) {
        fs.unlinkSync(destFile);
        success(`Deleted ${fileName}`);
      }
    }

    const skillsDestBase = isGlobal ? path.join(targetBaseDir, envConfig.skillsDir) : targetBaseDir;

    coreSkills.forEach(skill => {
      const dest = path.join(skillsDestBase, skill);
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
        success(`Deleted skill '${skill}' from ${isGlobal ? envConfig.skillsDir : 'root'}`);
      }
    });

    if (env === 'cursor') {
      const mdcPath = path.join(targetBaseDir, '.cursor', 'rules', 'maestro.mdc');
      if (fs.existsSync(mdcPath)) {
        fs.unlinkSync(mdcPath);
        success('Deleted maestro.mdc');
      }
    }
  });
  console.log(`\n${accent('Done!')} Maestro removed.`);
};

const init = (selectedEnvs, isGlobal, targetBaseDir) => {
  let successCount = 0;

  selectedEnvs.forEach(env => {
    const envConfig = envs[env];
    const folderName = envConfig.dir;
    const fileName = envConfig.file;

    const srcDir = path.join(sourceDir, folderName);
    const destDir = path.join(targetBaseDir, folderName);

    if (fs.existsSync(srcDir)) {
      console.log(`\n${muted('Installing')} ${accent(folderName)} ${muted(`to ${isGlobal ? 'global' : 'workspace'}...`)}`);
      copyRecursiveSync(srcDir, destDir);
      success(`${folderName} installed`);
      successCount++;
    }

    if (fileName) {
      const srcFile = path.join(sourceDir, fileName);
      const destFile = path.join(targetBaseDir, fileName);
      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, destFile);
        success(`${fileName} copied`);
      }
    }

    // Keep flat so environment slash command parsers can detect them.
    const skillsDestBase = isGlobal ? path.join(targetBaseDir, envConfig.skillsDir) : targetBaseDir;

    if (!fs.existsSync(skillsDestBase)) {
      fs.mkdirSync(skillsDestBase, { recursive: true });
    }

    coreSkills.forEach(skill => {
      const src = path.join(sourceDir, skill);
      const dest = path.join(skillsDestBase, skill);
      if (fs.existsSync(src)) {
        copyRecursiveSync(src, dest);
        success(`Installed ${skill} command`);
      }
    });
  });

  if (successCount > 0) {
    console.log(`\n${accent('Done!')} Run ${accent('/maestro')} to get started.`);
    console.log(muted(`Installed ${isGlobal ? 'globally' : 'locally'}.`));
  }
};

const main = async () => {
  const state = {};
  state.action = command || await askAction(state);
  state.isGlobal = await askScope(state);
  state.selectedEnvs = await askEnvs(state);
  const targetBaseDir = state.isGlobal ? os.homedir() : process.cwd();

  closePrompt();

  renderInstallScreen(state, () => {
    console.log(accent(state.action === 'uninstall' ? 'Uninstalling' : 'Installing'));
  });

  if (state.action === 'uninstall') {
    uninstall(state.selectedEnvs, state.isGlobal, targetBaseDir);
    return;
  }

  init(state.selectedEnvs, state.isGlobal, targetBaseDir);
};

main().catch(error => {
  closePrompt();
  console.error(danger(error.message));
  process.exit(1);
});
