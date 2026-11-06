// Shared diff plumbing for the constraint scripts.
// Diff = merge base with --base (default: main) → working tree, plus untracked files.
import { execFileSync } from 'node:child_process';

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (err) {
    // `git diff --no-index` exits 1 when files differ; that is still a valid diff.
    if (err.status === 1 && typeof err.stdout === 'string') return err.stdout;
    return null;
  }
}

function resolveBase() {
  const i = process.argv.indexOf('--base');
  const base = i > -1 ? process.argv[i + 1] : 'main';
  if (git(['rev-parse', '--is-inside-work-tree'])?.trim() !== 'true') return null;
  // No commits yet: compare against the empty tree so the first task is still checked.
  if (git(['rev-parse', '--verify', 'HEAD']) === null) return EMPTY_TREE;
  return git(['merge-base', base, 'HEAD'])?.trim() || null;
}

/** Returns { base, added: [{file, line, text}], removed: [{file, text}] } or null if it cannot run. */
export function collectDiff() {
  const base = resolveBase();
  if (!base) return null;

  const tracked = git(['diff', '--unified=0', base, '--']) ?? '';
  const untracked = (git(['ls-files', '--others', '--exclude-standard']) ?? '')
    .split('\n')
    .filter(Boolean)
    .map((f) => git(['diff', '--no-index', '--unified=0', '/dev/null', f]) ?? '')
    .join('\n');

  const added = [];
  const removed = [];
  let file = '';
  let oldFile = '';
  let line = 0;
  for (const raw of (tracked + '\n' + untracked).split('\n')) {
    if (raw.startsWith('--- ')) {
      oldFile = raw.slice(4).replace(/^a\//, '');
    } else if (raw.startsWith('+++ ')) {
      // A deleted file's new side is /dev/null: attribute its removed lines to the old path.
      const next = raw.slice(4).replace(/^b\//, '');
      file = next === '/dev/null' ? oldFile : next;
    } else if (raw.startsWith('@@')) {
      line = Number(/\+(\d+)/.exec(raw)?.[1] ?? 0);
    } else if (raw.startsWith('+')) {
      added.push({ file, line, text: raw.slice(1) });
      line += 1;
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      removed.push({ file, text: raw.slice(1) });
    }
  }
  return { base, added, removed };
}
