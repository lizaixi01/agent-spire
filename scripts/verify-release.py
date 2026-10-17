"""Verify one published source/Pages/player-package snapshot (requires gh)."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--directory', type=Path, default=root / 'release')
parser.add_argument('--before-publish', action='store_true', help='Verify CI package, main and Pages before creating a Release')
args = parser.parse_args()
repo = 'lizaixi01/agent-spire'

def github(path):
    return json.loads(subprocess.check_output(['gh', 'api', path], encoding='utf-8'))

def require(condition, message):
    if not condition:
        raise SystemExit(message)

manifest = json.loads((args.directory / 'RELEASE-MANIFEST.json').read_text(encoding='utf-8'))
version, commit = manifest['version'], manifest['commit']
require(commit and manifest['uncommitted'] is False, 'Release build must identify a clean Git commit.')
archive = args.directory / manifest['archive']
require(archive.name == manifest['archive'], 'Archive must be a plain filename.')
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
require(digest == manifest['sha256'], 'ZIP checksum differs from manifest.')
require(archive.stat().st_size == manifest['bytes'] <= 10 * 1024 * 1024, 'ZIP size differs or exceeds 10 MiB.')
require((args.directory / 'SHA256SUMS.txt').read_text(encoding='utf-8').split() == [digest, archive.name], 'Checksum file differs.')
with ZipFile(archive) as bundle:
    require(bundle.testzip() is None, 'ZIP integrity check failed.')
    info = json.loads(bundle.read(f'agent-spire-v{version}/dist/build-info.json'))
    require(info == {key: manifest[key] for key in ('version', 'commit', 'uncommitted')}, 'ZIP build identity differs.')
    require(not any('/node_modules/' in name or '/reference/' in name for name in bundle.namelist()), 'ZIP includes development material.')

require(github(f'repos/{repo}/commits/main')['sha'] == commit, 'GitHub main differs from Release.')
if not args.before_publish:
    require(github(f'repos/{repo}/commits/v{version}')['sha'] == commit, 'Release tag differs from build.')
    latest = github(f'repos/{repo}/releases/latest')
    require(latest['tag_name'] == f'v{version}', 'Latest Release version differs.')
    for path in (archive, args.directory / 'SHA256SUMS.txt', args.directory / 'RELEASE-MANIFEST.json'):
        asset = next((item for item in latest['assets'] if item['name'] == path.name), None)
        expected_digest = 'sha256:' + hashlib.sha256(path.read_bytes()).hexdigest()
        require(asset and asset['state'] == 'uploaded' and asset['size'] == path.stat().st_size and
                asset['digest'] == expected_digest, f'Uploaded asset differs: {path.name}')
request = Request(f'https://lizaixi01.github.io/agent-spire/build-info.json?commit={commit}', headers={'Cache-Control': 'no-cache'})
with urlopen(request, timeout=60) as response:
    online = json.load(response)
require(online == info, 'Live Pages build differs from Release.')
scope = 'main, Pages and CI ZIP' if args.before_publish else 'main, tag, Pages and Release assets'
print(f'PASS: v{version}, {commit}; {scope} match; {manifest["bytes"]:,} bytes; SHA256 verified.')
