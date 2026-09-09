/**
 * Exercise the pinned builder's Git ownership boundary with real Nix and libgit2.
 *
 * @file
 */

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { readBuilderManifest } from '../src/build/canonical-build.mjs';
import { runConsumerCommand } from '../src/adoption/consumer-checks.mjs';

const root = resolve(import.meta.dirname, '..');
const execute = runConsumerCommand;
const { manifest } = await readBuilderManifest(root);
const gitConfig = join(homedir(), '.gitconfig');
const readHostConfig = () => readFile(gitConfig).catch(error => {
	if(error.code === 'ENOENT') return null;
	throw error;
});
const before = await readHostConfig();
await mkdir(join(root, 'build'), { recursive: true });
const fixture = await mkdtemp(join(root, 'build/builder-ownership-'));

try
{
	await mkdir(join(fixture, 'engine'));
	await mkdir(join(fixture, 'component'));
	await writeFile(join(fixture, 'engine/flake.nix'), `{
  outputs = { self }: {
    apps.x86_64-linux.component-build-engine = {
      type = "app";
      program = "\${self}/probe.sh";
    };
  };
}\n`);
	await writeFile(join(fixture, 'engine/flake.lock'), '{"nodes":{"root":{}},"root":"root","version":7}\n');
	await writeFile(join(fixture, 'engine/tracked.txt'), 'verified-ownership');
	await writeFile(join(fixture, 'engine/.gitignore'), 'ignored.txt\n');
	await writeFile(join(fixture, 'engine/ignored.txt'), 'must-not-enter-the-source-closure');
	await writeFile(join(fixture, 'request.json'), '{}\n');
	await writeFile(join(fixture, 'engine/probe.sh'), `#!/bin/sh
set -eu
test "$(nix --extra-experimental-features nix-command eval --impure --raw --expr 'builtins.readFile ((builtins.fetchGit { url = "/workspace/engine"; }).outPath + "/tracked.txt")')" = verified-ownership
test "$(nix --extra-experimental-features nix-command eval --impure --json --expr 'builtins.pathExists ((builtins.fetchGit { url = "/workspace/engine"; }).outPath + "/ignored.txt")')" = false
mkdir -p "$LEAN_BRIDGE_OUTPUT"
`, { mode: 0o755 });
	await writeFile(join(fixture, 'run.sh'), `#!/bin/sh
set -eu
cp -R /test/engine /workspace/engine
git -C /workspace/engine init --quiet
git -C /workspace/engine add flake.nix flake.lock tracked.txt .gitignore probe.sh
git -C /workspace/engine -c user.name=Ownership -c user.email=ownership@example.invalid -c commit.gpgSign=false commit --quiet -m fixture
cp -R /workspace/engine /workspace/unrelated
# Change only the two disposable in-container fixtures, never a mounted host path.
chown -R 12345:12345 /workspace/engine /workspace/unrelated
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0=/workspace/engine
git -C /workspace/engine rev-parse --verify HEAD >/dev/null
if nix --extra-experimental-features nix-command eval --impure --raw --expr '(builtins.fetchGit { url = "/workspace/engine"; }).outPath' >/workspace/before.out 2>/workspace/before.err; then
  echo 'The old environment-only setting unexpectedly passed' >&2
  exit 1
fi
grep -q 'not owned by current user' /workspace/before.err
unset GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0
export LEAN_BRIDGE_COMPONENT=/test/component LEAN_BRIDGE_REQUEST=/test/request.json
unset LEAN_BRIDGE_ENGINE_PROGRAM
export LEAN_BRIDGE_OUTPUT=/workspace/result
/usr/local/bin/lean-bridge-builder component
test "$(git config --global --get-all safe.directory)" = /workspace/engine
if nix --extra-experimental-features nix-command eval --impure --raw --expr '(builtins.fetchGit { url = "/workspace/unrelated"; }).outPath' >/workspace/unrelated.out 2>/workspace/unrelated.err; then
  echo 'The unrelated checkout unexpectedly became trusted' >&2
  exit 1
fi
grep -q 'not owned by current user' /workspace/unrelated.err
echo 'Ownership boundary passed: old setting rejected, selected source accepted, unrelated source rejected.'
`, { mode: 0o755 });
	const result = await execute(process.env.LEAN_BRIDGE_DOCKER ?? 'docker', [
		'run', '--rm', '--network', 'none', '--platform', manifest.platform
		, '--mount', `type=bind,source=${fixture},target=/test,readonly`
		, '--entrypoint', '/bin/sh', manifest.image.localTag, '/test/run.sh'
	], { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024 });
	assert.match(result.stdout, /Ownership boundary passed/u);
	await mkdir(join(fixture, 'cached-store'));
	await mkdir(join(fixture, 'cached-output'));
	await writeFile(join(fixture, 'cached-probe.sh'), `#!/bin/sh
set -eu
if command -v git >/dev/null || command -v nix >/dev/null; then
  echo 'The cached-path fixture must not contain Git or Nix' >&2
  exit 1
fi
test -e /workspace/engine/.git
test "$1" = --request && test "$2" = /test/request.json
test "$3" = --component && test "$4" = /test/component
test "$5" = --output && test "$6" = /workspace/output/execution
test "$7" = --engine && test "$8" = /workspace/engine
test "$9" = --backend && test "\${10}" = docker-nix
test "$#" = 10
mkdir -p "$LEAN_BRIDGE_OUTPUT"
echo 'Cached engine executed without Git or Nix.' > "$LEAN_BRIDGE_OUTPUT/result.txt"
`, { mode: 0o755 });
	const cachedArgs = [
		'run', '--rm', '--network', 'none', '--platform', manifest.platform
		, '--mount', `type=bind,source=${root},target=/workspace/engine,readonly`
		, '--mount', `type=bind,source=${fixture},target=/test,readonly`
		, '--mount'
		, `type=bind,source=${join(fixture, 'cached-store')},target=/nix/store,readonly`
		, '--mount'
		, `type=bind,source=${join(fixture, 'cached-output')},target=/workspace/output`
		, '--env', 'LEAN_BRIDGE_COMPONENT=/test/component'
		, '--env', 'LEAN_BRIDGE_REQUEST=/test/request.json'
		, '--env', 'LEAN_BRIDGE_OUTPUT=/workspace/output/execution'
		, '--env', `LEAN_BRIDGE_OUTPUT_UID=${process.getuid()}`
		, '--env', `LEAN_BRIDGE_OUTPUT_GID=${process.getgid()}`
	];
	for(const program of ['/test/missing', '/test/request.json'])
	{
		await assert.rejects(execute(process.env.LEAN_BRIDGE_DOCKER ?? 'docker', [
			...cachedArgs
			, '--env'
			, `LEAN_BRIDGE_ENGINE_PROGRAM=${program}`
			, manifest.image.localTag
			, 'component'
		], { cwd: root, timeout: 30000 }), error => {
			assert.equal(error.code, 2);
			assert.match(error.stderr, /cached component engine is unavailable/u);
			assert.doesNotMatch(error.stderr, /git: not found/u);
			return true;
		});
	}
	const cached = await execute(process.env.LEAN_BRIDGE_DOCKER ?? 'docker', [
		...cachedArgs
		, '--env'
		, 'LEAN_BRIDGE_ENGINE_PROGRAM=/test/cached-probe.sh'
		, manifest.image.localTag
		, 'component'
	], { cwd: root, timeout: 30000 });
	assert.equal(cached.stderr, '');
	assert.match(await readFile(join(fixture, 'cached-output/execution/result.txt'), 'utf8'), /Cached engine executed without Git or Nix/u);
	assert.deepEqual(await readHostConfig(), before, 'The host Git configuration must remain unchanged');
	console.log(JSON.stringify({
		status: 'passed'
		, image: manifest.image.localTag
		, definitionSha256: manifest.definitionSha256
		, network: 'none', fixtureOwner: 12345, hostConfigurationUnchanged: true
		, selectedRepositoryAccepted: true
		, unrelatedRepositoryRejected: true
		, ignoredInputExcluded: true
		, uncachedNixEntryPoint: true
		, cachedWithoutGitOrNix: true
		, unavailableCachedProgramsRejected: true
		, stdout: result.stdout, stderr: result.stderr
	}, null, 2));
}
finally
{
	await rm(fixture, { recursive: true, force: true });
}
