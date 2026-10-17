"""Release behavior without credentials, network, or publishing side effects."""
import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('release', Path(__file__).resolve().parents[2] / 'scripts/release.py')
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.state = self.root / 'output/release-state.json'
        self.metadata()

    def metadata(self):
        (self.root / 'package.json').write_text(json.dumps({'version': '0.1.2'}), encoding='utf-8')
        (self.root / 'package-lock.json').write_text(json.dumps({
            'version': '0.1.2', 'packages': {'': {'version': '0.1.2'}, 'node_modules/example': {'version': '9.0.0'}}}), encoding='utf-8')
        (self.root / 'README.md').write_text('Manual feature text\n<!-- release-version:start -->old\n<!-- release-version:end -->\nKeep me.\n', encoding='utf-8')

    def test_stable_version_bumps_and_explicit_version(self):
        self.assertEqual(release.next_version('0.1.2', 'patch'), '0.1.3')
        self.assertEqual(release.next_version('0.1.2', 'minor'), '0.2.0')
        self.assertEqual(release.next_version('0.1.2', 'major'), '1.0.0')
        self.assertEqual(release.next_version('0.1.2', '2.1.0'), '2.1.0')
        for invalid in ('0.1.2', '0.1.1', 'v0.2.0', '01.2.3', '1.2.3-beta', 'hello'):
            with self.subTest(invalid=invalid), self.assertRaises(RuntimeError):
                release.next_version('0.1.2', invalid)

    def test_only_one_publisher_can_run_and_lock_recovers_after_exception(self):
        with patch.object(release, 'STATE', self.state):
            with self.assertRaisesRegex(ValueError, 'simulated crash'):
                with release.release_lock():
                    with self.assertRaisesRegex(RuntimeError, 'already running'):
                        with release.release_lock():
                            self.fail('second publisher entered')
                    raise ValueError('simulated crash')
            with release.release_lock():
                pass

    def test_metadata_is_idempotent_and_preserves_manual_content_and_dependencies(self):
        release.update_metadata(self.root, '0.1.3')
        first = (self.root / 'README.md').read_bytes()
        release.update_metadata(self.root, '0.1.3')
        self.assertEqual((self.root / 'README.md').read_bytes(), first)
        text = first.decode('utf-8').replace('\r\n', '\n')
        self.assertTrue(text.startswith('Manual feature text\n'))
        self.assertTrue(text.endswith('Keep me.\n'))
        self.assertIn('agent-spire-v0.1.3-play.zip', text)
        self.assertIn('https://lizaixi01.github.io/agent-spire/', text)
        lock = json.loads((self.root / 'package-lock.json').read_text())
        self.assertEqual(lock['version'], lock['packages']['']['version'])
        self.assertEqual(lock['packages']['node_modules/example']['version'], '9.0.0')

    def test_missing_readme_markers_fail(self):
        (self.root / 'README.md').write_text('Unstructured README')
        with self.assertRaisesRegex(RuntimeError, 'markers'):
            release.update_metadata(self.root, '0.1.3')

    def test_fingerprint_detects_untracked_edits_and_deletions_but_ignores_output(self):
        subprocess.run(['git', 'init', '--quiet', str(self.root)], check=True)
        (self.root / '.gitignore').write_text('output/\n')
        original = release.fingerprint(self.root)
        (self.root / 'output').mkdir()
        (self.root / 'output/log').write_text('ignored')
        self.assertEqual(release.fingerprint(self.root), original)
        (self.root / 'new.txt').write_text('new feature')
        self.assertNotEqual(release.fingerprint(self.root), original)
        subprocess.run(['git', 'add', '--all'], cwd=self.root, check=True)
        staged = release.fingerprint(self.root)
        (self.root / 'new.txt').unlink()
        self.assertNotEqual(release.fingerprint(self.root), staged)

    def test_snapshot_uses_unignored_sources_without_shared_dependencies(self):
        subprocess.run(['git', 'init', '--quiet', str(self.root)], check=True)
        (self.root / '.gitignore').write_text('node_modules/\noutput/\n')
        (self.root / 'node_modules').mkdir()
        (self.root / 'node_modules/locked.exe').write_bytes(b'not copied')
        destination = self.root / 'output/snapshot'
        destination.mkdir(parents=True)
        release.copy_snapshot(self.root, destination)
        self.assertTrue((destination / 'package.json').is_file())
        self.assertFalse((destination / 'node_modules').exists())

    def fake_run(self, *args, **kwargs):
        if args[:2] == ('gh', 'api') and args[2].endswith('/releases/latest'):
            return json.dumps({'tag_name': 'v0.1.2'})
        if args[:3] == ('git', 'branch', '--show-current'):
            return 'main'
        if args[:4] == ('git', 'remote', 'get-url', 'origin'):
            return 'https://github.com/lizaixi01/agent-spire.git'
        if args[:3] == ('git', 'rev-parse', 'HEAD'):
            return 'abc123'
        if args[:2] == ('git', 'ls-remote'):
            return ''
        if args[:3] == ('git', 'status', '--porcelain'):
            return ''
        return ''

    def invoke(self, arguments, effect=None):
        patches = [patch.object(release, 'ROOT', self.root), patch.object(release, 'STATE', self.state),
                   patch.object(sys, 'argv', ['release.py', *arguments]),
                   patch.object(release, 'run', side_effect=effect or self.fake_run),
                   patch.object(release, 'release_record', return_value=None),
                   patch.object(release, 'copy_snapshot')]
        return patches

    def test_dry_run_does_not_edit_version_or_save_state(self):
        a, b, c, d, e, f = self.invoke(['--dry-run'])
        with a, b, c, d as runner, e, f:
            release.main()
        self.assertFalse(self.state.exists())
        self.assertEqual(json.loads((self.root / 'package.json').read_text())['version'], '0.1.2')
        self.assertFalse(any(call.args[:2] == ('git', 'push') for call in runner.call_args_list))

    def test_failed_tests_never_commit_or_push_and_resume_does_not_bump_again(self):
        def failed(*args, **kwargs):
            if args == ('npm', 'test'):
                raise subprocess.CalledProcessError(1, args)
            return self.fake_run(*args, **kwargs)
        for arguments in ([], ['--resume']):
            a, b, c, d, e, f = self.invoke(arguments, failed)
            with a, b, c, d as runner, e, f, patch.object(release, 'fingerprint', return_value='stable'):
                with self.assertRaises(subprocess.CalledProcessError):
                    release.main()
            self.assertEqual(json.loads(self.state.read_text())['version'], '0.1.3')
            self.assertFalse(any(call.args[:2] in (('git', 'commit'), ('git', 'push')) for call in runner.call_args_list))

    def test_concurrent_local_edit_stops_before_commit(self):
        a, b, c, d, e, f = self.invoke([])
        with a, b, c, d as runner, e, f, patch.object(release, 'fingerprint', side_effect=['before', 'before', 'changed']):
            with self.assertRaisesRegex(RuntimeError, 'changed during verification'):
                release.main()
        self.assertFalse(any(call.args[:2] == ('git', 'commit') for call in runner.call_args_list))

    def test_preparation_can_follow_fast_forward_merges_but_retests(self):
        release.update_metadata(self.root, '0.1.3')
        self.state.parent.mkdir()
        self.state.write_text(json.dumps({'version': '0.1.3', 'stage': 'prepared', 'base': 'older'}))

        def failed(*args, **kwargs):
            if args == ('npm', 'test'):
                raise subprocess.CalledProcessError(1, args)
            return self.fake_run(*args, **kwargs)

        a, b, c, d, e, f = self.invoke(['--resume'], failed)
        with a, b, c, d as runner, e, f, patch.object(release, 'fingerprint', return_value='stable'):
            with self.assertRaises(subprocess.CalledProcessError):
                release.main()
        self.assertEqual(json.loads(self.state.read_text())['base'], 'abc123')
        self.assertTrue(any(call.args == ('git', 'merge-base', '--is-ancestor', 'older', 'abc123') for call in runner.call_args_list))
        self.assertFalse(any(call.args[:2] == ('git', 'push') for call in runner.call_args_list))

    def test_unfinished_release_requires_resume(self):
        self.state.parent.mkdir()
        self.state.write_text(json.dumps({'version': '0.1.3', 'stage': 'prepared'}))
        a, b, c, d, e, f = self.invoke([])
        with a, b, c, d, e, f, self.assertRaisesRegex(RuntimeError, 'unfinished release'):
            release.main()

    def test_resume_after_push_reuses_commit_and_ci_without_retesting_or_bumping(self):
        release.update_metadata(self.root, '0.1.3')
        self.state.parent.mkdir()
        self.state.write_text(json.dumps({'version': '0.1.3', 'stage': 'pushed', 'commit': 'abc123', 'run': 123}))
        a, b, c, d, e, f = self.invoke(['--resume'])
        with a, b, c, d as runner, e, f, patch.object(release, 'assert_main'), \
                patch.object(release, 'wait_for_ci', side_effect=RuntimeError('CI failed')) as waiter:
            with self.assertRaisesRegex(RuntimeError, 'CI failed'):
                release.main()
        self.assertEqual(waiter.call_args.args[0]['run'], 123)
        self.assertFalse(any(call.args[0] == 'npm' or call.args[:2] == ('git', 'push') for call in runner.call_args_list))

    def test_successful_pipeline_copies_only_ci_artifact_and_marks_complete(self):
        def simulated(*args, **kwargs):
            if args[:3] == ('gh', 'run', 'download'):
                target = Path(args[args.index('--dir') + 1])
                manifest = {'archive': 'agent-spire-v0.1.3-play.zip'}
                (target / 'RELEASE-MANIFEST.json').write_text(json.dumps(manifest))
                (target / manifest['archive']).write_bytes(b'CI artifact')
                (target / 'SHA256SUMS.txt').write_text('CI checksum')
            return self.fake_run(*args, **kwargs)

        def ci(state):
            state['run'] = 123

        a, b, c, d, e, f = self.invoke([], simulated)
        with a, b, c, d as runner, e, f, patch.object(release, 'assert_main'), \
                patch.object(release, 'fingerprint', return_value='stable'), \
                patch.object(release, 'wait_for_ci', side_effect=ci), patch.object(release, 'publish') as publisher:
            release.main()
        self.assertEqual(json.loads(self.state.read_text())['stage'], 'complete')
        self.assertEqual((self.root / 'release/agent-spire-v0.1.3-play.zip').read_bytes(), b'CI artifact')
        self.assertEqual(publisher.call_args.args[0]['commit'], 'abc123')
        commands = [call.args for call in runner.call_args_list]
        self.assertLess(commands.index(('npm', 'test')), commands.index(('git', 'add', '--all')))
        self.assertLess(commands.index(('git', 'commit', '-m', 'Release v0.1.3')), commands.index(('git', 'push', 'origin', 'HEAD:main')))
        installs = [call for call in runner.call_args_list if call.args == ('npm', 'ci')]
        self.assertNotEqual(installs[0].kwargs['cwd'], self.root)

    def test_remote_main_change_blocks_publication(self):
        with patch.object(release, 'gh_json', return_value={'sha': 'newer'}):
            with self.assertRaisesRegex(RuntimeError, 'main changed'):
                release.assert_main('old')

    def test_existing_release_asset_is_never_overwritten(self):
        manifest = {'version': '0.1.3', 'commit': 'abc123', 'archive': 'agent-spire-v0.1.3-play.zip'}
        (self.root / 'RELEASE-MANIFEST.json').write_text(json.dumps(manifest))
        (self.root / manifest['archive']).write_bytes(b'new-content')
        record = {'draft': False, 'assets': [{'name': manifest['archive'], 'size': 11,
                  'digest': 'sha256:' + hashlib.sha256(b'old-content').hexdigest()}]}
        with patch.object(release, 'verify'), patch.object(release, 'assert_main'), \
                patch.object(release, 'run', return_value='abc123') as runner, \
                patch.object(release, 'gh_json', return_value={'sha': 'abc123'}), \
                patch.object(release, 'release_record', return_value=record):
            with self.assertRaisesRegex(RuntimeError, 'Never overwriting'):
                release.publish({'version': '0.1.3', 'commit': 'abc123'}, self.root)
        self.assertFalse(any(call.args[:3] == ('gh', 'release', 'upload') for call in runner.call_args_list))

    def test_draft_resume_only_uploads_missing_assets_then_publishes_and_verifies(self):
        manifest = {'version': '0.1.3', 'commit': 'abc123', 'archive': 'agent-spire-v0.1.3-play.zip'}
        (self.root / 'RELEASE-MANIFEST.json').write_text(json.dumps(manifest))
        (self.root / manifest['archive']).write_bytes(b'archive')
        (self.root / 'SHA256SUMS.txt').write_text('checksum')
        record = {'draft': True, 'assets': [{'name': manifest['archive'], 'size': 7,
                  'digest': 'sha256:' + hashlib.sha256(b'archive').hexdigest()}]}
        with patch.object(release, 'verify') as verifier, patch.object(release, 'assert_main'), \
                patch.object(release, 'run', return_value='abc123') as runner, \
                patch.object(release, 'gh_json', return_value={'sha': 'abc123'}), \
                patch.object(release, 'release_record', return_value=record):
            release.publish({'version': '0.1.3', 'commit': 'abc123'}, self.root)
        uploads = [call.args[3] for call in runner.call_args_list if call.args[:3] == ('gh', 'release', 'upload')]
        self.assertEqual(uploads, ['v0.1.3', 'v0.1.3'])
        self.assertFalse(any(call.args[:3] == ('gh', 'release', 'create') for call in runner.call_args_list))
        self.assertTrue(any(call.args[:3] == ('gh', 'release', 'edit') for call in runner.call_args_list))
        self.assertEqual(verifier.call_count, 2)

    def test_failed_ci_cannot_supply_release_artifacts(self):
        with patch.object(release, 'gh_json', return_value={
                'headSha': 'abc123', 'status': 'completed', 'conclusion': 'failure'}):
            with self.assertRaisesRegex(RuntimeError, 'CI failed'):
                release.wait_for_ci({'commit': 'abc123', 'run': 123})

    def test_ci_for_other_commit_is_rejected(self):
        with patch.object(release, 'gh_json', return_value={
                'headSha': 'other', 'status': 'completed', 'conclusion': 'success'}):
            with self.assertRaisesRegex(RuntimeError, 'different commit'):
                release.wait_for_ci({'commit': 'abc123', 'run': 123})


if __name__ == '__main__':
    unittest.main()
