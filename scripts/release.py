"""One-command, resumable release using the exact successful CI artifact."""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = 'lizaixi01/agent-spire'
STATE = ROOT / 'output/release-state.json'


@contextmanager
def release_lock():
    """OS-owned lock: a crash releases it; double-clicking cannot start two publishers."""
    STATE.parent.mkdir(parents=True, exist_ok=True)
    with (STATE.parent / 'release.lock').open('a+b') as handle:
        handle.seek(0, 2)
        if handle.tell() == 0:
            handle.write(b'0')
            handle.flush()
        handle.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as error:
            raise RuntimeError('Another release command is already running.') from error
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == 'nt':
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def run(*args, capture=False, cwd=ROOT):
    # Resolve npm.cmd on Windows, without interpreting arguments as shell code.
    command = [shutil.which(str(args[0])) or str(args[0]), *map(str, args[1:])]
    result = subprocess.run(command, cwd=cwd, check=True, text=True, encoding='utf-8',
                            stdout=subprocess.PIPE if capture else None)
    return result.stdout.strip() if capture else None


def gh_json(*args):
    return json.loads(run('gh', *args, capture=True))


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def version_tuple(value):
    require(re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', value),
            'Use a stable version such as 0.2.0 (no v prefix).')
    return tuple(map(int, value.split('.')))


def next_version(current, requested):
    major, minor, patch = version_tuple(current)
    value = {'patch': f'{major}.{minor}.{patch + 1}',
             'minor': f'{major}.{minor + 1}.0', 'major': f'{major + 1}.0.0'}.get(requested, requested)
    require(version_tuple(value) > (major, minor, patch), 'Release version must increase.')
    return value


def update_metadata(root, version):
    for filename in ('package.json', 'package-lock.json'):
        path = root / filename
        data = json.loads(path.read_text(encoding='utf-8'))
        data['version'] = version
        if filename == 'package-lock.json':
            data['packages']['']['version'] = version
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    path = root / 'README.md'
    text = path.read_text(encoding='utf-8')
    require(text.count('<!-- release-version:start -->') == 1 and
            text.count('<!-- release-version:end -->') == 1, 'README release markers are missing or duplicated.')
    block = (f'<!-- release-version:start -->\n'
             f'当前版本 **v{version}** · 游玩包 **`agent-spire-v{version}-play.zip`** · '
             '[在线体验](https://lizaixi01.github.io/agent-spire/) · '
             '[下载与精确体积](https://github.com/lizaixi01/agent-spire/releases/latest)\n'
             '<!-- release-version:end -->')
    text = re.sub(r'<!-- release-version:start -->.*?<!-- release-version:end -->', block, text, flags=re.S)
    path.write_text(text, encoding='utf-8')


def source_paths(root):
    names = subprocess.check_output(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=root)
    return sorted(set(names.split(b'\0')) - {b''})


def copy_snapshot(source, destination):
    for name in source_paths(source):
        path = source / os.fsdecode(name)
        if path.is_file():
            target = destination / os.fsdecode(name)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)


def fingerprint(root=ROOT):
    """Hash actual tracked/unignored files, independent of index and line ending conversion."""
    digest = hashlib.sha256()
    for name in source_paths(root):
        path = root / os.fsdecode(name)
        digest.update(name + b'\0')
        digest.update(path.read_bytes() if path.is_file() else b'<deleted>')
        digest.update(b'\0')
    return digest.hexdigest()


def save(state):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    temporary = STATE.with_suffix('.tmp')
    temporary.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')
    temporary.replace(STATE)


def assert_main(commit):
    require(gh_json('api', f'repos/{REPO}/commits/main')['sha'] == commit,
            'Remote main changed. Do not publish an older snapshot; finish the current changes first.')


def release_record(version):
    # Unlike /releases/latest, authenticated listing includes our recoverable drafts.
    releases = gh_json('api', '--paginate', '--slurp', f'repos/{REPO}/releases?per_page=100')
    return next((item for page in releases for item in page if item['tag_name'] == f'v{version}'), None)


def wait_for_ci(state):
    if not state.get('run'):
        for _ in range(30):
            runs = gh_json('run', 'list', '--repo', REPO, '--workflow', 'ci.yml', '--branch', 'main',
                           '--commit', state['commit'], '--event', 'push', '--json', 'databaseId')
            if runs:
                state['run'] = runs[0]['databaseId']
                save(state)
                break
            time.sleep(5)
        require(state.get('run'), 'No push workflow appeared. Check Actions, then resume.')
    details = gh_json('run', 'view', str(state['run']), '--repo', REPO,
                      '--json', 'headSha,status,conclusion')
    require(details['headSha'] == state['commit'], 'CI run belongs to a different commit.')
    if details['status'] != 'completed':
        run('gh', 'run', 'watch', str(state['run']), '--repo', REPO, '--exit-status', '--interval', '15')
        details = gh_json('run', 'view', str(state['run']), '--repo', REPO, '--json', 'conclusion')
    require(details['conclusion'] == 'success',
            f'CI failed. Inspect run {state["run"]}; rerun it with gh run rerun {state["run"]} --failed, then resume.')


def verify(directory, before=False):
    command = [sys.executable, 'scripts/verify-release.py', '--directory', str(directory)]
    if before:
        command.append('--before-publish')
    # Pages may take a short time to propagate after Actions completes.
    for attempt in range(6):
        try:
            run(*command)
            return
        except subprocess.CalledProcessError:
            if attempt == 5:
                raise
            print('Waiting for public metadata to converge (10 seconds)...', flush=True)
            time.sleep(10)


def publish(state, directory):
    version, commit = state['version'], state['commit']
    manifest = json.loads((directory / 'RELEASE-MANIFEST.json').read_text(encoding='utf-8'))
    require(manifest['version'] == version and manifest['commit'] == commit and
            manifest['archive'] == f'agent-spire-v{version}-play.zip', 'CI artifact identity differs.')
    verify(directory, before=True)
    assert_main(commit)
    tag = f'v{version}'
    tags = run('git', 'ls-remote', 'origin', f'refs/tags/{tag}', f'refs/tags/{tag}^{{}}', capture=True)
    if tags:
        require(gh_json('api', f'repos/{REPO}/commits/{tag}')['sha'] == commit, 'Existing tag points elsewhere.')
    assets = [directory / manifest['archive'], directory / 'SHA256SUMS.txt', directory / 'RELEASE-MANIFEST.json']
    record = release_record(version)
    if record is None:
        if not tags:
            run('gh', 'api', f'repos/{REPO}/git/refs', '-f', f'ref=refs/tags/{tag}', '-f', f'sha={commit}')
        notes = directory / 'release-notes.md'
        notes.write_text(
            f'在线体验：https://lizaixi01.github.io/agent-spire/\n\n'
            f'版本：v{version}；提交：{commit}\n\n'
            f'游玩包：{manifest["bytes"]:,} bytes（{manifest["bytes"] / 1024 / 1024:.2f} MiB，上限 10 MiB）。'
            '无需 npm 依赖；离线版需 Node.js 22.12+，在线版无需安装。\n\n'
            '全量测试、类型检查、双构建、包体积检查和 Pages 部署通过。'
            '附件直接来自同一提交的 CI player-package。SHA256 见 SHA256SUMS.txt。\n', encoding='utf-8')
        run('gh', 'release', 'create', tag, '--repo', REPO, '--target', commit, '--verify-tag', '--draft',
            '--title', f'Agent 尖塔 {tag}', '--notes-file', notes)
        record = release_record(version)
        require(record is not None, 'Draft is not visible yet. Resume after checking GitHub.')
    require(gh_json('api', f'repos/{REPO}/commits/{tag}')['sha'] == commit, 'Release tag differs.')
    for asset in assets:
        existing = next((item for item in record['assets'] if item['name'] == asset.name), None)
        if existing:
            require(existing.get('digest') == 'sha256:' + hashlib.sha256(asset.read_bytes()).hexdigest()
                    and existing['size'] == asset.stat().st_size, f'Existing asset differs: {asset.name}. Never overwriting it.')
        else:
            require(record['draft'], 'Published Release is missing an asset; refusing to mutate it.')
            run('gh', 'release', 'upload', tag, asset, '--repo', REPO)
    if record['draft']:
        assert_main(commit)
        run('gh', 'release', 'edit', tag, '--repo', REPO, '--draft=false', '--latest')
    verify(directory)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', default='patch', help='patch (default), minor, major, or explicit stable version')
    parser.add_argument('--resume', action='store_true', help='Continue the saved release without another version bump')
    parser.add_argument('--dry-run', action='store_true', help='Read-only preflight and show the next version')
    args = parser.parse_args()
    require(not (args.resume and args.dry_run), 'Choose --resume or --dry-run.')
    require(run('git', 'branch', '--show-current', capture=True) == 'main', 'Release from main only.')
    remote = run('git', 'remote', 'get-url', 'origin', capture=True)
    require(remote.removesuffix('.git') in (f'https://github.com/{REPO}', f'git@github.com:{REPO}',
                                          f'ssh://git@github.com/{REPO}'), 'Unexpected origin repository.')
    run('gh', 'auth', 'status')
    run('git', 'fetch', 'origin', 'main')
    run('git', 'merge-base', '--is-ancestor', 'origin/main', 'HEAD')
    state = json.loads(STATE.read_text(encoding='utf-8')) if STATE.exists() else None
    if args.resume:
        require(state is not None and state.get('stage') != 'complete', 'No unfinished release to resume.')
        require(json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version'] == state['version'],
                'Local version differs from saved release.')
    else:
        require(state is None or state.get('stage') == 'complete', 'An unfinished release exists. Use --resume; see docs/RELEASING.md.')
        current = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
        version = next_version(current, args.version)
        latest = gh_json('api', f'repos/{REPO}/releases/latest')['tag_name'].removeprefix('v')
        require(version_tuple(version) > version_tuple(latest), 'Version must exceed the latest published Release.')
        require(release_record(version) is None, 'That Release version already exists.')
        require(not run('git', 'ls-remote', 'origin', f'refs/tags/v{version}', capture=True), 'That tag already exists.')
        print(f'Release v{current} -> v{version}; tracked and unignored local changes are included.', flush=True)
        run('git', 'status', '--short')
        if args.dry_run:
            print('Read-only preflight passed; no files, commits, tags or releases changed.')
            return
        state = {'version': version, 'stage': 'preparing', 'base': run('git', 'rev-parse', 'HEAD', capture=True)}
        save(state)
    if state['stage'] in ('preparing', 'prepared'):
        latest = gh_json('api', f'repos/{REPO}/releases/latest')['tag_name'].removeprefix('v')
        require(version_tuple(state['version']) > version_tuple(latest), 'Prepared version is already published or outdated. Use a new version.')
        head = run('git', 'rev-parse', 'HEAD', capture=True)
        if head != state['base']:
            run('git', 'merge-base', '--is-ancestor', state['base'], head)
            state['base'] = head
            save(state)
            print('Preparation baseline advanced; all local checks will run again.', flush=True)
    if state['stage'] == 'preparing':
        require(run('git', 'rev-parse', 'HEAD', capture=True) == state['base'], 'HEAD changed during preparation.')
        update_metadata(ROOT, state['version'])
        state['stage'] = 'prepared'
        save(state)
    if state['stage'] == 'prepared':
        require(run('git', 'rev-parse', 'HEAD', capture=True) == state['base'], 'HEAD changed before release commit.')
        update_metadata(ROOT, state['version'])
        snapshot = fingerprint()
        # A running Windows dev server locks esbuild.exe. Never reinstall shared node_modules.
        with tempfile.TemporaryDirectory(prefix='agent-spire-release-') as temporary:
            workspace = Path(temporary)
            copy_snapshot(ROOT, workspace)
            require(fingerprint() == snapshot, 'Local files changed while copying. Resume to retest.')
            for command in [('npm', 'ci'), ('npm', 'test'), ('npm', 'run', 'check'),
                            ('npm', 'run', 'release:pack'), ('npm', 'run', 'build:pages')]:
                run(*command, cwd=workspace)
                require(fingerprint() == snapshot, 'Local files changed during verification. Finish edits, then --resume to retest.')
        run('git', 'add', '--all')
        require(fingerprint() == snapshot, 'Local files changed while staging. Resume to retest.')
        run('git', 'commit', '-m', f'Release v{state["version"]}')
        state['commit'] = run('git', 'rev-parse', 'HEAD', capture=True)
        state['stage'] = 'committed'
        save(state)
    require(run('git', 'rev-parse', 'HEAD', capture=True) == state['commit'], 'HEAD differs from saved release commit.')
    require(not run('git', 'status', '--porcelain', capture=True), 'Local edits remain. Finish the current release snapshot before resuming.')
    if state['stage'] == 'committed':
        run('git', 'push', 'origin', 'HEAD:main')
        state['stage'] = 'pushed'
        save(state)
    assert_main(state['commit'])
    wait_for_ci(state)
    directory = ROOT / 'output' / f'release-v{state["version"]}-run-{state["run"]}'
    # Unique attempt directory avoids treating partial downloads as complete after an interruption.
    directory.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='download-', dir=directory) as temporary:
        run('gh', 'run', 'download', str(state['run']), '--repo', REPO,
            '--name', 'player-package', '--dir', temporary)
        for file in Path(temporary).iterdir():
            require(file.is_file() and file.name in (f'agent-spire-v{state["version"]}-play.zip',
                    'SHA256SUMS.txt', 'RELEASE-MANIFEST.json'), 'Unexpected artifact file.')
            shutil.copy2(file, directory / file.name)
    publish(state, directory)
    manifest = json.loads((directory / 'RELEASE-MANIFEST.json').read_text(encoding='utf-8'))
    for name in (manifest['archive'], 'SHA256SUMS.txt', 'RELEASE-MANIFEST.json'):
        (ROOT / 'release').mkdir(exist_ok=True)
        shutil.copy2(directory / name, ROOT / 'release' / name)
    state['stage'] = 'complete'
    save(state)
    print(f'Published v{state["version"]}: source, Pages and ZIP verified at {state["commit"]}.')
    print(f'https://github.com/{REPO}/releases/tag/v{state["version"]}')


if __name__ == '__main__':
    try:
        if '--dry-run' in sys.argv:
            main()
        else:
            with release_lock():
                main()
    except (RuntimeError, subprocess.CalledProcessError, OSError, ValueError) as error:
        print(f'Release stopped: {error}\nState: {STATE}\nFix the cause, then: npm run release -- --resume', file=sys.stderr)
        sys.exit(1)
