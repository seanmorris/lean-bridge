/**
 * Require every recursive JVM fault shape, path and injected allocation failure.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sha256 } from '../../src/capsule/node.mjs';

const shapes = ['array', 'list', 'option', 'result', 'tuple', 'record', 'variant', 'alias', 'recursive'];
const paths = ['callback', 'create', 'create-call', 'held-call', 'repeated'];

/**
 * Reject missing fault cases, ownership leaks or incomplete retirement observations.
 *
 * @param observation - One language and execution mode from the native probe.
 */
export const assertJvmRecursiveFaultObservation = observation => {
	assert.ok(['java', 'kotlin'].includes(observation.profile));
	assert.ok(Number.isSafeInteger(observation.checks) && observation.checks > 0);
	if(observation.mode === 'poison')
	{
		assert.equal(observation.retired, 1);
		assert.equal(observation.malformed, 1);
		assert.equal(observation.clears, 1);
		return;
	}
	assert.equal(observation.mode, 'faults');
	assert.equal(observation.deferred, 36);
	assert.equal(observation.identities, 0);
	assert.equal(observation.hosts, 0);
	assert.ok(Number.isSafeInteger(observation.clears) && observation.clears > 0);
	assert.deepEqual(observation.shapes.map(row => [row.seed, row.shape])
		, Array.from({ length: 4 }, (_, seed) => shapes.map(shape => [seed, shape])).flat());
	let failures = 0;
	for(const row of observation.shapes)
	{
		assert.deepEqual(Object.keys(row.paths).sort(), paths);
		let expected = 0;
		for(const counters of Object.values(row.paths))
		{
			assert.deepEqual(Object.keys(counters).sort(), ['checkpoints', 'hostAllocations', 'nativeAllocations']);
			for(const value of Object.values(counters)) assert.ok(Number.isSafeInteger(value) && value >= 0);
			assert.ok(counters.checkpoints > 0);
			expected += 2 * counters.checkpoints + counters.hostAllocations + counters.nativeAllocations;
		}
		assert.equal(row.faults, expected);
		failures += expected;
	}
	assert.ok(failures > 10_000);
	assert.equal(observation.faults, failures);
};

/**
 * Bind the complete fault and lifetime matrix to the unchanged installed package.
 *
 * @param report - Isolated probes recorded during original offline installation.
 * @param jvm - Installed archive and public declaration identities.
 */
export const assertJvmRecursiveProbes = async (report, jvm) => {
	assert.equal(report.installedPackagesUnchanged, true);
	assert.equal(report.isolatedProbes, true);
	assert.equal(report.originalHash, jvm.archiveSha256);
	assert.equal(report.layout, 170);
	const prefix = 'src/main/java/org/leanbridge/structured/';
	for(const sourceMap of [report.originalSources, report.instrumentedSources, report.nativeSources, report.instrumentedNative, report.lifetimes.sources, ...Object.values(report.ownership.sourceHashes)])
	{
		assert.ok(Object.keys(sourceMap).length > 0);
		for(const value of Object.values(sourceMap)) assert.match(value, /^[a-f0-9]{64}$/u);
	}
	assert.equal(report.originalSources[prefix + 'Api.java'], jvm.declarationsSha256);
	for(const [path, hash] of Object.entries(report.originalSources))
	{
		if(/\/(?:_GraphRuntime|_CallableGraphRuntime|_CallableGraphNative)\.java$/u.test(path))
			assert.notEqual(report.instrumentedSources[path], hash, path);
		else assert.equal(report.instrumentedSources[path], hash, path);
	}
	const adapters = Object.entries(jvm.nativeLibraries).filter(([name]) => name === 'libstructured.so');
	assert.equal(adapters.length, 1); assert.equal(report.originalAdapter, adapters[0][1]);
	assert.match(report.instrumentedAdapter, /^[a-f0-9]{64}$/u);
	assert.notEqual(report.instrumentedAdapter, report.originalAdapter);
	assert.notEqual(report.nativeSources['src/native.c'], report.instrumentedNative['src/native.c']);
	assert.deepEqual(report.edits, {
		adopt: 1
		, allocations: 1
		, arenas: 1
		, checkpoints: 1
		, clear: 78
		, closeFrames: 1
		, closed: 1
		, conversion: 2
		, frames: 1
		, opened: 1
		, register: 1
		, release: 1
		, returned: 102
		, roots: 1
		, scopes: 1
		, stubs: 36
	});
	assert.deepEqual(report.observations.map(run => [run.profile, run.mode]), [
		['java', 'faults']
		, ['java', 'poison']
		, ['kotlin', 'faults']
		, ['kotlin', 'poison']
	]);
	for(const run of report.observations)
	{
		assertJvmRecursiveFaultObservation(run);
		assert.equal(run.checks, run.mode === 'faults' ? 824369 : 195);
		if(run.mode === 'faults')
		{
			assert.equal(run.faults, 41857); assert.equal(run.clears, 46794);
			assert.deepEqual(run.shapes, report.observations[0].shapes);
		}
	}
	for(const name of ['GraphFaultProbe', 'GraphFaultCases'])
		assert.equal(report.instrumentedSources[prefix + name + '.java'], sha256(await readFile('tests/fixtures/structured-callable-consumers/jvm-recursive-' + name + '.java')));
	const ownership = report.ownership;
	assert.equal(ownership.checkedBeforeDecode, true);
	assert.deepEqual(Object.keys(ownership.sourceHashes).sort(), ['baseline', 'reply-scope', 'retirement']);
	assert.deepEqual(ownership.observations.map(run => [run.mode, run.profile])
		, ['baseline', 'reply-scope', 'retirement'].flatMap(mode => ['java', 'kotlin'].map(profile => [mode, profile])));
	for(const run of ownership.observations)
	{
		if(run.mode === 'retirement')
		{
			assert.equal(run.rejected, true); assert.equal(run.exitCode, 1);
			assert.match(run.stderr, /^Exception in thread "main" java\.lang\.AssertionError: retirement missing after malformed output\n/u);
			assert.doesNotMatch(run.stderr, /SIG|fatal error|hs_err|timed out/u);
			continue;
		}
		assert.equal(run.checkedBeforeDecode, true);
		assert.equal(run.checks, run.mode === 'baseline' ? 9 : 1);
		assert.deepEqual(run.errors, run.mode === 'baseline' ? [] : ['Array', 'List', 'Result', 'Tuple', 'Record', 'Variant', 'Alias', 'Recursive']);
	}
	for(const mode of ['baseline', 'reply-scope', 'retirement'])
	{
		const hashes = ownership.sourceHashes[mode];
		assert.equal(hashes[prefix + 'GraphOwnership.java'], sha256(await readFile('tests/fixtures/structured-callable-consumers/jvm-recursive-GraphOwnership.java')));
		assert.equal(hashes[prefix + '_CallableGraphNative.java'], report.instrumentedSources[prefix + '_CallableGraphNative.java']);
		if(mode === 'baseline') assert.equal(hashes[prefix + '_CallableGraphRuntime.java'], report.instrumentedSources[prefix + '_CallableGraphRuntime.java']);
		else assert.notEqual(hashes[prefix + '_CallableGraphRuntime.java'], report.instrumentedSources[prefix + '_CallableGraphRuntime.java']);
	}
	assert.equal(new Set(Object.values(ownership.sourceHashes).map(hashes => hashes[prefix + '_CallableGraphRuntime.java'])).size, 3);
	assert.deepEqual(report.lifetimes.observations, ['java', 'kotlin'].map(profile => ({
		profile
		, checks: 8235
		, identities: 0
		, capacity: 4096
		, recovered: 8192
		, cleaner: true
		, simulatedFork: true
		, actualFork: false
	})));
	assert.equal(report.lifetimes.sources[prefix + 'GraphLifetime.java'], sha256(await readFile('tests/fixtures/structured-callable-consumers/jvm-recursive-GraphLifetime.java')));
	assert.notEqual(report.lifetimes.sources[prefix + '_CallableGraphRuntime.java'], report.instrumentedSources[prefix + '_CallableGraphRuntime.java']);
};
