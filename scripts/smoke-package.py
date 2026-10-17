"""Extract and serve the actual player ZIP, checking every shipped game resource."""
import hashlib
import json
import os
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.error import URLError
from urllib.parse import quote
from urllib.request import urlopen
from zipfile import ZipFile

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'release/RELEASE-MANIFEST.json').read_text(encoding='utf-8'))
archive = root / 'release' / manifest['archive']
if archive.name != manifest['archive'] or hashlib.sha256(archive.read_bytes()).hexdigest() != manifest['sha256']:
    raise SystemExit('Player archive differs from manifest.')

with tempfile.TemporaryDirectory(prefix='agent-spire-package-') as temporary:
    destination = Path(temporary)
    prefix = f'agent-spire-v{manifest["version"]}/'
    with ZipFile(archive) as bundle:
        if bundle.testzip() or any(not name.startswith(prefix) or '..' in Path(name).parts for name in bundle.namelist()):
            raise SystemExit('Invalid player archive.')
        bundle.extractall(destination)
    package = destination / prefix
    with socket.socket() as available:
        available.bind(('127.0.0.1', 0))
        port = available.getsockname()[1]
    process = subprocess.Popen(['node', str(package / 'scripts/serve-game.mjs'), str(port)],
                               cwd=package, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                               creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    try:
        base = f'http://127.0.0.1:{port}/'
        for _ in range(50):
            if process.poll() is not None:
                raise SystemExit('Packaged server failed: ' + process.stderr.read().decode('utf-8', errors='replace'))
            try:
                with urlopen(base, timeout=2) as response:
                    if response.read() != (package / 'dist/index.html').read_bytes():
                        raise SystemExit('Packaged home page differs.')
                break
            except URLError:
                time.sleep(0.1)
        else:
            raise SystemExit('Packaged server did not start.')
        count = 0
        for file in (package / 'dist').rglob('*'):
            if file.is_file():
                url = base + quote(file.relative_to(package / 'dist').as_posix())
                with urlopen(url, timeout=5) as response:
                    if response.status != 200 or response.read() != file.read_bytes():
                        raise SystemExit(f'Packaged resource failed: {file.name}')
                count += 1
        print(f'PASS: extracted player ZIP starts without npm dependencies; {count} resources served intact.')
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        process.stderr.close()
