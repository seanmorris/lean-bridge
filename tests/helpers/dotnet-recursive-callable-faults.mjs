/**
 * Require complete recursive C# fault, lifetime, ownership and typed-caller evidence.
 *
 * @file
 */
import assert from 'node:assert/strict';

const shapes = ['array', 'list', 'option', 'result', 'tuple', 'record', 'variant', 'alias', 'recursive'];
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const natural = value => assert.ok(Number.isSafeInteger(value) && value >= 0);

/**
 * Reject missing ownership, allocation, lifetime or typed-consumer observations.
 *
 * @param record - Measured recursive C# probe outcomes and exact source identities.
 */
export const assertDotnetRecursiveProbes = record => {
	assert.deepEqual(record.recursive, { checks: 8808, nesting: 64, layout: 170 });
	assert.deepEqual(record.lifetimes, { checks: 19, capacity: 4096, identities: 0, finalized: true });
	assert.equal(record.authenticatedLoaderRetained, true);
	assert.equal(record.installedAssetIsolation, true);
	digest(record.installedAssemblySha256);
	for(const kind of ['structuredTypes', 'recursiveTypes'])
	{
		const types = record[kind];
		assert.equal(types.assemblySha256, record.installedAssemblySha256);
		assert.match(types.sdk, /^8\.0\.\d+$/u);
		assert.equal(types.rejected.length, kind === 'structuredTypes' ? 14 : 10);
		assert.equal(new Set(types.rejected.map(item => item.name)).size, types.rejected.length);
		for(const item of types.rejected)
		{
			digest(item.sourceSha256); assert.ok(item.codes.length > 0);
			for(const code of item.codes) assert.match(code, /^CS\d+$/u);
		}
	}
	assert.equal(record.recursiveTypes.namedArgumentsCompile, true);
	digest(record.recursiveTypes.namedArgumentSourceSha256);
	digest(record.structuredTypes.compilerSha256);
	digest(record.structuredTypes.rejectionSourceSha256);
	const faults = record.faults;
	assert.deepEqual({ ...faults, shapes: undefined }, { checks: 784369, faults: 23663, clears: 25110, deferred: 36, identities: 0, shapes: undefined });
	assert.deepEqual(faults.shapes.map(item => [item.seed, item.shape]), [0, 1, 2, 3].flatMap(seed => shapes.map(shape => [seed, shape])));
	let total = 0;
	for(const row of faults.shapes)
	{
		assert.deepEqual(Object.keys(row.paths).sort(), ['callback', 'create', 'create-call', 'held-call', 'repeated']);
		let sum = 0;
		for(const counts of Object.values(row.paths))
		{
			assert.deepEqual(Object.keys(counts).sort(), ['checkpoints', 'hostAllocations', 'nativeAllocations']);
			for(const count of Object.values(counts)) natural(count);
			assert.ok(counts.checkpoints > 0);
			sum += 2 * counts.checkpoints + counts.hostAllocations + counts.nativeAllocations;
		}
		assert.equal(row.faults, sum); total += sum;
	}
	assert.equal(faults.faults, total);
	assert.deepEqual(record.poison, { checks: 49, retired: 1, malformed: 1, clears: 1 });
	const ownership = record.ownership;
	assert.deepEqual(Object.keys(ownership), ['baseline', 'reply-scope', 'retirement']);
	assert.deepEqual({ ...ownership.baseline, sources: undefined }, { checks: 9, errors: [], checkedBeforeDecode: true, sources: undefined });
	assert.deepEqual({ ...ownership['reply-scope'], sources: undefined }, { checks: 1, errors: ['Array', 'List', 'Result', 'Tuple', 'Record', 'Variant', 'Alias', 'Recursive'], checkedBeforeDecode: true, sources: undefined });
	assert.equal(ownership.retirement.rejected, true); assert.equal(ownership.retirement.exitCode, 32);
	assert.match(ownership.retirement.stderr, /retirement missing after malformed output/u);
	const { originalAdapterSha256, instrumentedAdapterSha256 } = record;
	digest(originalAdapterSha256); digest(instrumentedAdapterSha256);
	assert.notEqual(originalAdapterSha256, instrumentedAdapterSha256);
	assert.deepEqual(Object.keys(record.originalSources).sort(), ['Api.cs', 'Calls.cs', 'Runtime.cs', 'Values.cs']);
	for(const kind of ['originalSources', 'originalAdapterSources', 'baselineSources', 'instrumentedSources'])
	{
		assert.ok(Object.keys(record[kind]).length > 0);
		for(const hash of Object.values(record[kind])) digest(hash);
	}
	for(const [name, hash] of Object.entries(record.originalSources))
	{
		assert.equal(record.baselineSources[name], hash);
		if(['Api.cs', 'Values.cs'].includes(name)) assert.equal(record.instrumentedSources[name], hash);
		else assert.notEqual(record.instrumentedSources[name], hash);
	}
	assert.deepEqual(record.edits, { checkpoints: 1, allocation: 1, release: 2, scopes: 1, closeScopes: 1, conversion: 58, clear: 1, frames: 1, roots: 1, closeFrames: 1, adopt: 1, returned: 51, poisonedSymbol: 1 });
	for(const value of Object.values(ownership))
	{
		assert.ok(Object.keys(value.sources).length > 10);
		for(const hash of Object.values(value.sources)) digest(hash);
	}
	assert.notEqual(ownership.baseline.sources['Calls.cs'], ownership['reply-scope'].sources['Calls.cs']);
	assert.notEqual(ownership.baseline.sources['Calls.cs'], ownership.retirement.sources['Calls.cs']);
	for(const name of ['include/lean/lean.h', 'include/lean_bridge_native_runtime.h'])
	{
		digest(record.runtimeHeaders[name].sha256); assert.ok(record.runtimeHeaders[name].bytes > 0);
	}
};
