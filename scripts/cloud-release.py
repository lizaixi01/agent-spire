"""GitHub Actions release preparation, compare-and-push, and publication."""
import argparse
import json
import os
import sys
from pathlib import Path

import release

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / 'output/cloud-release.json'
METADATA = {'package.json', 'package-lock.json', 'README.md'}


def outputs(**values):
    path = os.environ.get('GITHUB_OUTPUT')
    if path:
        with open(path, 'a', encoding='utf-8') as stream:
            for key, value in values.items():
                stream.write(f'{key}={str(value).lower() if isinstance(value, bool) else value}\n')


def reusable_commit(source, head):
    """Only our metadata-only release child can resume an earlier source run."""
    parent = release.run('git', 'show', '-s', '--format=%P', head, capture=True)
    message = release.run('git', 'show', '-s', '--format=%B', head, capture=True)
    author = release.run('git', 'show', '-s', '--format=%ae', head, capture=True)
    changed = set(release.run('git', 'diff-tree', '--no-commit-id', '--name-only', '-r', head, capture=True).splitlines())
    return (parent == source and f'Release-Source: {source}' in message.splitlines()
            and author == '41898282+github-actions[bot]@users.noreply.github.com'
            and changed == METADATA)


def prepare(source):
    release.require(release.run('git', 'status', '--porcelain', capture=True) == '', 'Checkout must be clean.')
    release.run('git', 'fetch', 'origin', 'main')
    head = release.run('git', 'rev-parse', 'origin/main', capture=True)
    reuse = reusable_commit(source, head) if head != source else False
    if head == source:
        # Manual dispatch on the bot commit retries that version instead of bumping again.
        parent = release.run('git', 'show', '-s', '--format=%P', head, capture=True)
        if reusable_commit(parent, head):
            source, reuse = parent, True
    if head != source and not reuse:
        print('A newer source push exists; this superseded run will not deploy or release.')
        outputs(active=False)
        return
    release.run('git', 'checkout', '--detach', head)
    if not reuse:
        current = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
        latest = release.gh_json('api', f'repos/{release.REPO}/releases/latest')['tag_name'].removeprefix('v')
        baseline = max((current, latest), key=release.version_tuple)
        version = release.next_version(baseline, 'patch')
        release.require(release.release_record(version) is None, 'Next version already has a Release.')
        release.update_metadata(ROOT, version)
        release.run('git', 'config', 'user.name', 'github-actions[bot]')
        release.run('git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')
        release.run('git', 'add', '--', *sorted(METADATA))
        release.run('git', 'commit', '-m', f'Release v{version}\n\nRelease-Source: {source}')
    else:
        version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
    commit = release.run('git', 'rev-parse', 'HEAD', capture=True)
    state = {'source': source, 'commit': commit, 'version': version}
    STATE.parent.mkdir(exist_ok=True)
    STATE.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')
    outputs(active=True, commit=commit, version=version)
    print(f'Prepared v{version} at {commit}; source {source}; reused={reuse}.')


def push_prepared():
    state = json.loads(STATE.read_text(encoding='utf-8'))
    release.require(release.run('git', 'rev-parse', 'HEAD', capture=True) == state['commit'], 'Prepared HEAD changed.')
    release.require(not release.run('git', 'status', '--porcelain', capture=True), 'Tests changed tracked source files.')
    remote = release.gh_json('api', f'repos/{release.REPO}/commits/main')['sha']
    if remote not in (state['source'], state['commit']):
        print('main advanced during testing; leaving publication to its queued run.')
        outputs(ready=False)
        return
    # An ordinary fast-forward push is also the atomic race check; never force-push.
    release.run('git', 'push', 'origin', f'{state["commit"]}:refs/heads/main')
    outputs(ready=True)


def publish():
    commit = release.run('git', 'rev-parse', 'HEAD', capture=True)
    version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
    release.publish({'version': version, 'commit': commit}, ROOT / 'release')
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        manifest = json.loads((ROOT / 'release/RELEASE-MANIFEST.json').read_text(encoding='utf-8'))
        with open(summary, 'a', encoding='utf-8') as stream:
            stream.write(f'Published **v{version}** at `{commit}`.\n\n'
                         f'Player ZIP: **{manifest["bytes"]:,} bytes** (limit 10 MiB).\n\n'
                         f'[Play online](https://lizaixi01.github.io/agent-spire/) · '
                         f'[Download](https://github.com/{release.REPO}/releases/tag/v{version})\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=('prepare', 'push', 'assert-main', 'publish'))
    args = parser.parse_args()
    if args.operation == 'prepare':
        prepare(os.environ['SOURCE_SHA'])
    elif args.operation == 'push':
        push_prepared()
    elif args.operation == 'assert-main':
        release.assert_main(release.run('git', 'rev-parse', 'HEAD', capture=True))
    else:
        publish()


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, ValueError) as error:
        print(f'Cloud release stopped: {error}', file=sys.stderr)
        sys.exit(1)
