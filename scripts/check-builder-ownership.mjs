/**
 * Exercise the pinned builder's Git ownership boundary with real Nix and libgit2.
 *
 * @file
 */

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { readBuilderManifest } from '../src/build/canonical-build.mjs';

const root = resolve(import.meta.dirname, '..');
const execute = promisify(execFile);
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
	await writeFile(join(fixture, 'engine/flake.nix'), '{ outputs = { self }: {}; }\n');
	await writeFile(join(fixture, 'engine/flake.lock'), '{}\n');
	await writeFile(join(fixture, 'engine/tracked.txt'), 'verified-ownership');
	await writeFile(join(fixture, 'engine/.gitignore'), 'ignored.txt\n');
	await writeFile(join(fixture, 'engine/ignored.txt'), 'must-not-enter-the-source-closure');
	await writeFile(join(fixture, 'request.json'), '{}\n');
	await writeFile(join(fixture, 'probe.sh'), `#!/bin/sh
set -eu
test "$(nix --extra-experimental-features nix-command eval --impure --raw --expr 'builtins.readFile ((builtins.fetchGit { url = "/workspace/engine"; }).outPath + "/tracked.txt")')" = verified-ownership
test "$(nix --extra-experimental-features nix-command eval --impure --json --expr 'builtins.pathExists ((builtins.fetchGit { url = "/workspace/engine"; }).outPath + "/ignored.txt")')" = false
mkdir -p "$LEAN_BRIDGE_OUTPUT"
`, { mode: 0o755 });
	await writeFile(join(fixture, 'run.sh'), `#!/bin/sh
set -eu
cp -R /test/engine /workspace/engine
git -C /workspace/engine init --quiet
git -C /workspace/engine add flake.nix flake.lock tracked.txt .gitignore
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
export LEAN_BRIDGE_ENGINE_PROGRAM=/test/probe.sh LEAN_BRIDGE_OUTPUT=/workspace/result
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
	assert.deepEqual(await readHostConfig(), before, 'The host Git configuration must remain unchanged');
	console.log(JSON.stringify({
		status: 'passed'
		, image: manifest.image.localTag
		, definitionSha256: manifest.definitionSha256
		, network: 'none', fixtureOwner: 12345, hostConfigurationUnchanged: true
		, selectedRepositoryAccepted: true
		, unrelatedRepositoryRejected: true
		, ignoredInputExcluded: true
		, stdout: result.stdout, stderr: result.stderr
	}, null, 2));
}
finally
{
	await rm(fixture, { recursive: true, force: true });
}
