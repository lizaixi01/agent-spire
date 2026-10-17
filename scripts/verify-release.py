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
require(github(f'repos/{repo}/commits/v{version}')['sha'] == commit, 'Release tag differs from build.')
latest = github(f'repos/{repo}/releases/latest')
require(latest['tag_name'] == f'v{version}', 'Latest Release version differs.')
asset = next((item for item in latest['assets'] if item['name'] == archive.name), None)
require(asset and asset['state'] == 'uploaded' and asset['size'] == manifest['bytes'] and asset['digest'] == f'sha256:{digest}', 'Uploaded asset differs from verified ZIP.')
request = Request(f'https://lizaixi01.github.io/agent-spire/build-info.json?commit={commit}', headers={'Cache-Control': 'no-cache'})
with urlopen(request, timeout=60) as response:
    online = json.load(response)
require(online == info, 'Live Pages build differs from Release.')
print(f'PASS: v{version}, {commit}; main, tag, Pages and ZIP match; {manifest["bytes"]:,} bytes; SHA256 verified.')
