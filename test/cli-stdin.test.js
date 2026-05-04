const assert = require('assert');
const fs = require('fs');
const path = require('path');

const cliSource = fs.readFileSync(path.join(__dirname, '..', 'bin', 'cli.js'), 'utf8');

assert(
  !/const\s+pipedAnswers\s*=\s*process\.stdin\.isTTY\s*\?\s*null\s*:\s*fs\.readFileSync\(0/.test(cliSource),
  'CLI must not synchronously read fd 0 at module load; that can make npx appear to hang before rendering the installer.'
);

assert(
  cliSource.includes("require('readline')") && cliSource.includes('readline.createInterface'),
  'CLI must use readline when raw TTY mode is unavailable so Git Bash/npx can still prompt step by step.'
);

assert(
  !/!\s*process\.stdin\.isTTY[\s\S]{0,180}Promise\.resolve\(''\)/.test(cliSource),
  'CLI must not auto-select defaults only because stdin is not a TTY.'
);

assert(
  !cliSource.includes('fs.fstatSync(0)'),
  'CLI must not infer piped input from fstat(fd 0); Git Bash and PowerShell can expose stdin in ways that make this unreliable.'
);

assert(
  cliSource.includes('let fallbackReadline = null'),
  'CLI must keep one readline interface alive so piped answers are consumed in order across prompts.'
);

assert(
  cliSource.includes('fallbackAnswerQueue') && cliSource.includes("fallbackReadline.on('line'"),
  'CLI must queue readline lines so piped answers are not dropped between prompts.'
);

assert(
  cliSource.includes('!process.stdin.isTTY || !process.stdout.isTTY'),
  'CLI must use readline unless both stdin and stdout are TTYs; npx/Git Bash can expose only one side as TTY-like.'
);
