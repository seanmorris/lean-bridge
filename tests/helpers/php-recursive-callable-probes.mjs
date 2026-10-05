/**
 * Installed PHP graph failure, ownership and process-lifetime probes.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { sha256 } from '../../src/capsule/node.mjs';
import { nativeArtifactPaths, verifyNativeFiles } from '../../src/build/native-artifacts.mjs';
import { runCopied, copiedCleanEnvironment } from './copied-fixture-install.mjs';
import { preparePhpRecursiveNativeProbe } from './php-recursive-callable-native.mjs';
import { assertPhpRecursiveFaults, assertPhpRecursivePoison, assertPhpRecursiveOwnership, assertPhpRecursiveLifetimes } from './php-recursive-callable-faults.mjs';

const execute = promisify(execFile);
const fixture = name => resolve('tests/fixtures/structured-callable-consumers/php-recursive-' + name);

/**
 * Check original installed bytes around every isolated fault and mutant process.
 *
 * @param options - Verified Composer installation and task-owned scratch directory.
 * @param options.root - Isolated probes directory.
 * @param options.installed - Relocated original deployment.
 * @param options.php - Original installed PHP evidence.
 * @param options.nativeEvidence - Original native asset identities.
 * @param options.environment - Explicit PHP and C tool paths.
 * @param options.diagnostic - Progress callback.
 */
export const checkPhpRecursiveProbes = async ({ root, installed, php, nativeEvidence, environment, diagnostic }) => {
	await mkdir(root, { recursive: true });
	const unchanged = async () => {
		assert.deepEqual((await nativeArtifactPaths(installed)).sort(), Object.keys(php.deployment).sort());
		await verifyNativeFiles(installed, php.deployment);
	};
	await unchanged();
	const sourceHashes = {};
	for(const name of ['host-faults.php', 'native-faults.php', 'lifetimes.php', 'ownership.php', 'retirement-mutant.php', 'forward.c'])
		sourceHashes['php-recursive-' + name] = sha256(await readFile(fixture(name)));
	const run = async (name, deployment, ...args) => {
		const result = await runCopied(environment.LEAN_BRIDGE_PHP, [...php.runtimeOptions, fixture(name), deployment, ...args], root);
		assert.equal(result.stderr, ''); await unchanged();
		return JSON.parse(result.stdout);
	};
	diagnostic('PHP host failures: four seeds, nine shapes, five paths, RuntimeException and Error at every checkpoint');
	const host = await run('host-faults.php', installed);
	assertPhpRecursiveFaults(host, 'host');
	diagnostic('PHP host failures: ' + host.faults + ' injected failures, zero retained identities');
	const lifetimes = await run('lifetimes.php', installed);
	assertPhpRecursiveLifetimes(lifetimes);
	diagnostic('PHP lifetimes: real fork, stale generation, Fiber, GC and 8192-slot recovery passed');
	const forward = join(root, 'forward.so');
	await runCopied(environment.CC ?? '/usr/bin/cc', ['-std=c11', '-O2', '-Wall', '-Wextra', '-Werror', '-fPIC', '-shared', fixture('forward.c'), '-o', forward], root, environment);
	const ownership = [];
	for(const mode of ['baseline', 'reply-scope'])
	{
		const observation = await run('ownership.php', installed, mode, forward);
		assertPhpRecursiveOwnership(observation, mode === 'reply-scope');
		ownership.push({ mode, ...observation });
	}
	diagnostic('PHP reply ownership: baseline and premature-release mutant passed without unsafe decoding');
	const adapter = await preparePhpRecursiveNativeProbe({ work: join(root, 'native'), installed, php, nativeEvidence, environment });
	const deployment = join(adapter.work, 'deployment');
	const native = await run('native-faults.php', deployment, 'faults');
	assertPhpRecursiveFaults(native, 'native');
	const poisoned = [];
	for(const mode of [1, 2, 3, 4, 5])
	{
		const observation = await run('native-faults.php', deployment, String(mode));
		assertPhpRecursivePoison(observation, mode); poisoned.push(observation);
	}
	let mutant;
	try
	{
		await execute(environment.LEAN_BRIDGE_PHP, [...php.runtimeOptions, fixture('retirement-mutant.php'), deployment, '1'], {
			cwd: root
			, env: copiedCleanEnvironment
			, timeout: 30_000
			, maxBuffer: 1024 * 1024
		});
		assert.fail('Missing-retirement mutant escaped detection');
	} catch(error)
	{
		assert.equal(error.code, 1); assert.equal(error.signal, null); assert.equal(error.killed, false);
		assert.equal(error.stdout, ''); assert.equal(error.stderr, 'malformed_output_retires_runtime\n');
		mutant = { exitCode: error.code, signal: error.signal, killed: error.killed, stdout: error.stdout, stderr: error.stderr };
	}
	await unchanged();
	diagnostic('PHP native failures: ' + native.faults + ' allocation failures, five malformed results, retirement mutant detected');
	return {
		sourceHashes
		, originalPackagesUnchanged: true
		, originalArchiveSha256: php.archiveSha256
		, forwardSha256: sha256(await readFile(forward))
		, host
		, lifetimes
		, ownership
		, adapter
		, native
		, poisoned
		, mutant
	};
};
