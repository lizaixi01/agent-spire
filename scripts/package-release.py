"""Package an already built game with Python's standard library only."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
dist = root / 'dist'
if not (dist / 'index.html').is_file():
    raise SystemExit('Run npm run build first.')
build_info = json.loads((dist / 'build-info.json').read_text(encoding='utf-8'))
if build_info['version'] != version:
    raise SystemExit('Build version is stale. Run npm run build again.')
output = root / 'release'
output.mkdir(exist_ok=True)
name = f'agent-spire-v{version}'
archive = output / f'{name}-play.zip'
extra = ['启动游戏.cmd', 'scripts/start-game.ps1', 'scripts/serve-game.mjs',
         'docs/PLAY.md', 'docs/ASSETS.md']
with ZipFile(archive, 'w', ZIP_DEFLATED, compresslevel=9) as bundle:
    for path in sorted(dist.rglob('*')):
        if path.is_file():
            bundle.write(path, f'{name}/{path.relative_to(root).as_posix()}')
    for relative in extra:
        bundle.write(root / relative, f'{name}/{relative}')
size = archive.stat().st_size
if size > 10 * 1024 * 1024:
    archive.unlink()
    raise SystemExit('Player ZIP exceeds the 10 MiB release budget.')
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(output / 'SHA256SUMS.txt').write_text(f'{digest}  {archive.name}\n', encoding='utf-8')
manifest = {**build_info, 'archive': archive.name, 'bytes': size, 'sha256': digest}
(output / 'RELEASE-MANIFEST.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(f'{archive.name}: {size:,} bytes ({size / 1024 / 1024:.2f} MiB)')
