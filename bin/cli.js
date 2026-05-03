#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const command = args[0];

if (command !== 'init' && command !== 'uninstall') {
  console.log('Usage: npx maestro-ai <init|uninstall> [--cursor] [--claude] [--antigravity] [--codex] [--global]');
  process.exit(1);
}

const isGlobal = args.includes('--global');
const targetBaseDir = isGlobal ? os.homedir() : process.cwd();

const envs = {
  cursor: { dir: '.cursor', file: null, skillsDir: '.cursor/skills' },
  claude: { dir: '.claude', file: 'CLAUDE.md', skillsDir: '.claude/skills' },
  antigravity: { dir: '.gemini', file: 'GEMINI.md', skillsDir: path.join('.gemini', 'antigravity', 'skills') },
  codex: { dir: '.agents', file: 'AGENTS.md', skillsDir: path.join('.agents', 'skills') },
  agents: { dir: '.agents', file: 'AGENTS.md', skillsDir: path.join('.agents', 'skills') }
};

const selectedEnvs = Object.keys(envs).filter(env => args.includes(`--${env}`));

if (selectedEnvs.length === 0) {
  console.log('Error: Specify at least one env flag. Example: npx maestro-ai init --cursor');
  process.exit(1);
}

if (command === 'uninstall') {
  selectedEnvs.forEach(env => {
    const envConfig = envs[env];
    const fileName = envConfig.file;
    
    if (fileName) {
      const destFile = path.join(targetBaseDir, fileName);
      if (fs.existsSync(destFile)) {
        fs.unlinkSync(destFile);
        console.log(`✓ Deleted ${fileName}`);
      }
    }

    const skillsDestBase = isGlobal ? path.join(targetBaseDir, envConfig.skillsDir) : targetBaseDir;
    const coreSkills = ['maestro', 'maestro-fetch', 'maestro-stats', 'maestro-set'];
    
    coreSkills.forEach(skill => {
      const dest = path.join(skillsDestBase, skill);
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
        console.log(`✓ Deleted skill '${skill}' from ${isGlobal ? envConfig.skillsDir : 'root'}`);
      }
    });

    if (env === 'cursor') {
      const mdcPath = path.join(targetBaseDir, '.cursor', 'rules', 'maestro.mdc');
      if (fs.existsSync(mdcPath)) {
        fs.unlinkSync(mdcPath);
        console.log(`✓ Deleted maestro.mdc`);
      }
    }
  });
  console.log(`\nUninstall complete.`);
  process.exit(0);
}

const copyRecursiveSync = (src, dest) => {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
};

const sourceDir = path.join(__dirname, '..');
let successCount = 0;

selectedEnvs.forEach(env => {
  const envConfig = envs[env];
  const folderName = envConfig.dir;
  const fileName = envConfig.file;
  
  const srcDir = path.join(sourceDir, folderName);
  const destDir = path.join(targetBaseDir, folderName);
  
  if (fs.existsSync(srcDir)) {
    console.log(`\nCopying ${folderName} config to ${isGlobal ? 'global' : 'workspace'}...`);
    copyRecursiveSync(srcDir, destDir);
    console.log(`✓ ${folderName} installed successfully.`);
    successCount++;
  }

  if (fileName) {
    const srcFile = path.join(sourceDir, fileName);
    const destFile = path.join(targetBaseDir, fileName);
    if (fs.existsSync(srcFile)) {
      console.log(`Copying ${fileName}...`);
      fs.copyFileSync(srcFile, destFile);
      console.log(`✓ ${fileName} copied.`);
    }
  }

  // Copy core skills
  const coreSkills = ['maestro', 'maestro-fetch', 'maestro-stats', 'maestro-set'];
  // Keep flat so environment slash command parsers can detect them
  const skillsDestBase = isGlobal ? path.join(targetBaseDir, envConfig.skillsDir) : targetBaseDir;
  
  if (!fs.existsSync(skillsDestBase)) {
    fs.mkdirSync(skillsDestBase, { recursive: true });
  }

  coreSkills.forEach(skill => {
    const src = path.join(sourceDir, skill);
    const dest = path.join(skillsDestBase, skill);
    if (fs.existsSync(src)) {
      copyRecursiveSync(src, dest);
      console.log(`✓ Core skill '${skill}' copied to ${isGlobal ? envConfig.skillsDir : 'root'}.`);
    }
  });
});

if (successCount > 0) {
  console.log(`\nDone! You can now use Maestro ${isGlobal ? 'globally' : 'locally'}.`);
}
