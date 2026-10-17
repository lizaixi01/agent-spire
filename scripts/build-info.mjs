import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
let commit = null;
let uncommitted = null;
try {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (realpathSync(git('rev-parse', '--show-toplevel')) !== realpathSync(root)) {
    throw new Error('This source copy is inside an unrelated checkout.');
  }
  commit = git('rev-parse', 'HEAD');
  uncommitted = git('status', '--porcelain').length > 0;
} catch {
  // Source archives can still build without Git; their origin remains explicit.
}
writeFileSync(resolve(root, 'public/build-info.json'), JSON.stringify({ version, commit, uncommitted }, null, 2) + '\n');
