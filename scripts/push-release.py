"""Submit local updates; GitHub Actions owns versioning, testing and publishing."""
import argparse
import subprocess
import sys

import release


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    release.require(release.run('git', 'branch', '--show-current', capture=True) == 'main', 'Use main.')
    remote = release.run('git', 'remote', 'get-url', 'origin', capture=True).removesuffix('.git')
    release.require(remote in (f'https://github.com/{release.REPO}', f'git@github.com:{release.REPO}',
                               f'ssh://git@github.com/{release.REPO}'), 'Unexpected origin.')
    release.run('git', 'fetch', 'origin', 'main')
    release.run('git', 'merge-base', '--is-ancestor', 'origin/main', 'HEAD')
    release.run('git', 'status', '--short')
    if args.dry_run:
        print('No local version bump. Pushing main will start cloud testing and release.')
        return
    snapshot = release.fingerprint()
    release.run('git', 'add', '--all')
    release.require(release.fingerprint() == snapshot, 'Files changed while staging. Finish edits and retry.')
    if release.run('git', 'diff', '--cached', '--name-only', capture=True):
        release.run('git', 'commit', '-m', 'Update Agent Spire')
    release.require(not release.run('git', 'status', '--porcelain', capture=True), 'Files changed; retry before pushing.')
    release.run('git', 'push', 'origin', 'HEAD:main')
    print('Push complete. GitHub Actions will finish the release; this terminal can be closed.')
    print(f'https://github.com/{release.REPO}/actions/workflows/ci.yml')


if __name__ == '__main__':
    try:
        with release.release_lock():
            main()
    except (RuntimeError, OSError, subprocess.CalledProcessError) as error:
        print(f'Push stopped: {error}', file=sys.stderr)
        sys.exit(1)
