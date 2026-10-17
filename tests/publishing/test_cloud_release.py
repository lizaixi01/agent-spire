"""Exercise cloud retries and races against real local Git repositories."""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[2] / 'scripts'
sys.path.insert(0, str(SCRIPTS))
SPEC = importlib.util.spec_from_file_location('cloud_release', SCRIPTS / 'cloud-release.py')
cloud = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(cloud)


class CloudReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.work = self.root / 'work'
        self.remote = self.root / 'remote.git'
        self.work.mkdir()
        self.git('init', '--bare', str(self.remote))
        self.git('init', '-b', 'main')
        self.git('config', 'user.name', 'Test User')
        self.git('config', 'user.email', 'test@example.invalid')
        self.git('config', 'core.autocrlf', 'false')
        self.git('remote', 'add', 'origin', str(self.remote))
        (self.work / '.gitignore').write_text('output/\n')
        (self.work / 'package.json').write_text(json.dumps({'version': '0.1.3'}))
        (self.work / 'package-lock.json').write_text(json.dumps({'version': '0.1.3', 'packages': {'': {'version': '0.1.3'}}}))
        (self.work / 'README.md').write_text('Feature text\n<!-- release-version:start -->old<!-- release-version:end -->\n')
        self.git('add', '--all')
        self.git('commit', '-m', 'User update')
        self.git('push', 'origin', 'HEAD:main')
        self.source = self.git('rev-parse', 'HEAD')
        self.output = self.root / 'outputs'
        for item in (patch.object(cloud, 'ROOT', self.work),
                     patch.object(cloud, 'STATE', self.work / 'output/cloud-release.json'),
                     patch.object(cloud.release, 'run', side_effect=self.execute),
                     patch.object(cloud.release, 'gh_json', side_effect=self.github),
                     patch.object(cloud.release, 'release_record', return_value=None),
                     patch.dict(os.environ, {'GITHUB_OUTPUT': str(self.output)})):
            item.start()
            self.addCleanup(item.stop)

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.work, stderr=subprocess.DEVNULL, encoding='utf-8').strip()

    def execute(self, *args, capture=False, **kwargs):
        result = subprocess.run(list(args), cwd=self.work, check=True, encoding='utf-8',
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return result.stdout.strip() if capture else None

    def github(self, *args):
        if args[-1].endswith('/releases/latest'):
            return {'tag_name': 'v0.1.3'}
        return {'sha': self.git('--git-dir', str(self.remote), 'rev-parse', 'main')}

    def advance_remote(self):
        other = self.root / 'other'
        subprocess.run(['git', 'clone', '-b', 'main', str(self.remote), str(other)], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for args in (['config', 'user.name', 'Other'], ['config', 'user.email', 'other@example.invalid']):
            subprocess.run(['git', *args], cwd=other, check=True)
        (other / 'new-feature.txt').write_text('newer source')
        for args in (['add', '--all'], ['commit', '-m', 'Newer feature'], ['push', 'origin', 'main']):
            subprocess.run(['git', *args], cwd=other, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    def test_version_commit_is_clean_and_not_pushed_until_checks_succeed(self):
        cloud.prepare(self.source)
        self.assertEqual(json.loads((self.work / 'package.json').read_text())['version'], '0.1.4')
        self.assertEqual(self.git('status', '--porcelain'), '')
        self.assertEqual(self.github('api', 'commits/main')['sha'], self.source)
        prepared = self.git('rev-parse', 'HEAD')
        self.assertTrue(cloud.reusable_commit(self.source, prepared))
        cloud.push_prepared()
        self.assertEqual(self.github('api', 'commits/main')['sha'], prepared)
        self.assertIn('ready=true', self.output.read_text())

    def test_retry_reuses_pushed_version_and_commit(self):
        cloud.prepare(self.source)
        prepared = self.git('rev-parse', 'HEAD')
        cloud.push_prepared()
        self.git('checkout', '--detach', self.source)
        cloud.prepare(self.source)
        self.assertEqual(self.git('rev-parse', 'HEAD'), prepared)
        self.assertEqual(json.loads((self.work / 'package.json').read_text())['version'], '0.1.4')
        cloud.prepare(prepared)  # manual workflow_dispatch at the bot commit
        self.assertEqual(self.git('rev-parse', 'HEAD'), prepared)

    def test_newer_push_during_tests_stops_deployment_without_force_push(self):
        cloud.prepare(self.source)
        self.advance_remote()
        cloud.push_prepared()
        self.assertIn('ready=false', self.output.read_text())
        self.assertNotEqual(self.github('api', 'commits/main')['sha'], self.git('rev-parse', 'HEAD'))

    def test_superseded_run_does_not_bump_version(self):
        self.advance_remote()
        cloud.prepare(self.source)
        self.assertIn('active=false', self.output.read_text())
        self.assertEqual(json.loads((self.work / 'package.json').read_text())['version'], '0.1.3')

    def test_tests_that_change_source_cannot_push_version(self):
        cloud.prepare(self.source)
        with (self.work / 'README.md').open('a') as stream:
            stream.write('unexpected change')
        with self.assertRaisesRegex(RuntimeError, 'source files'):
            cloud.push_prepared()
        self.assertEqual(self.github('api', 'commits/main')['sha'], self.source)

    def test_human_commit_cannot_impersonate_a_retry_with_release_message(self):
        self.assertFalse(cloud.reusable_commit(self.source, self.source))


class ReproduciblePackageTests(unittest.TestCase):
    def test_package_hash_is_independent_of_file_timestamps(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'scripts').mkdir()
            shutil.copy2(SCRIPTS / 'package-release.py', root / 'scripts/package-release.py')
            (root / 'dist').mkdir()
            (root / 'package.json').write_text(json.dumps({'version': '0.1.4'}))
            (root / 'dist/index.html').write_text('<title>Agent</title>')
            (root / 'dist/build-info.json').write_text(json.dumps({'version': '0.1.4', 'commit': 'a' * 40, 'uncommitted': False}))
            for name in ('启动游戏.cmd', 'scripts/start-game.ps1', 'scripts/serve-game.mjs', 'docs/PLAY.md', 'docs/ASSETS.md'):
                path = root / name
                path.parent.mkdir(exist_ok=True)
                path.write_text('fixture')
            subprocess.run([sys.executable, str(root / 'scripts/package-release.py')], check=True, stdout=subprocess.DEVNULL)
            first = (root / 'release/agent-spire-v0.1.4-play.zip').read_bytes()
            for path in root.rglob('*'):
                if path.is_file():
                    os.utime(path, (1700000000, 1700000000))
            subprocess.run([sys.executable, str(root / 'scripts/package-release.py')], check=True, stdout=subprocess.DEVNULL)
            self.assertEqual(first, (root / 'release/agent-spire-v0.1.4-play.zip').read_bytes())
