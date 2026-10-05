/**
 * Independent expectations for PHP graph fault and lifetime observations.
 *
 * @file
 */
import assert from 'node:assert/strict';

const paths = ['callback', 'repeated', 'create', 'create-call', 'held-call'];
const shapes = ['array', 'list', 'option', 'result', 'tuple', 'record', 'variant', 'alias', 'recursive'];
const host = {
	array: [162, 217, 52, 153, 101]
	, list: [206, 294, 73, 199, 126]
	, option: [74, 99, 28, 79, 51]
	, result: [118, 153, 33, 114, 81]
	, tuple: [171, 243, 68, 175, 107]
	, record: [351, 481, 108, 310, 202]
	, variant: [191, 242, 55, 170, 115]
	, alias: [351, 481, 108, 310, 202]
};
const native = {
	array: [4, 6, 0, 2, 2]
	, list: [5, 7, 0, 2, 2]
	, option: [0, 0, 0, 0, 0]
	, result: [2, 2, 0, 0, 0]
	, tuple: [6, 9, 0, 3, 3]
	, record: [9, 14, 0, 5, 5]
	, variant: [5, 7, 0, 2, 2]
	, alias: [9, 14, 0, 5, 5]
};
const recursive = {
	host: [[263, 347, 73, 232, 159], [329, 415, 75, 270, 195], [393, 479, 75, 306, 231], [457, 543, 75, 342, 267]]
	, native: [[4, 5, 0, 1, 1], [6, 8, 0, 2, 2], [7, 9, 0, 2, 2], [8, 10, 0, 2, 2]]
};

/**
 * Require every measured failure point across four seeds and all five call paths.
 *
 * @param observation - JSON emitted by the bounded PHP fault process.
 * @param mode - Host RuntimeException/Error injection or native allocation failure.
 */
export const assertPhpRecursiveFaults = (observation, mode) => {
	assert.ok(['host', 'native'].includes(mode));
	assert.equal(observation.liveIdentities, 0);
	const expected = [0, 1, 2, 3].flatMap(seed => shapes.map(shape => {
		const counts = shape === 'recursive' ? recursive[mode][seed] : (mode === 'host' ? host : native)[shape];
		return {
			seed
			, shape
			, paths: Object.fromEntries(paths.map((path, index) => [path, counts[index]]))
			, ...mode === 'host' ? { faults: 2 * counts.reduce((sum, count) => sum + count, 0) } : {}
		};
	}));
	assert.deepEqual(observation.shapes, expected);
	if(mode === 'host')
	{
		assert.equal(observation.checks, 1_112_848);
		assert.equal(observation.faults, 65_884);
		assert.equal(observation.clears, 95_942);
		assert.equal(observation.closes, 122_598);
		assert.equal(observation.drops, 10_232);
		assert.equal(observation.installedPackageUnchanged, true);
		assert.equal(observation.inMemoryInstrumentation, true);
	} else
	{
		assert.equal(observation.checks, 22_266);
		assert.equal(observation.faults, 619);
		assert.equal(observation.clears, 1527);
		assert.equal(observation.layoutChecks, 170);
		assert.equal(observation.liveNativeAllocations, 0);
		assert.equal(observation.retirements, 0);
	}
};

/**
 * Check each malformed-output case in a fresh process, including prior retirement.
 *
 * @param observation - JSON emitted after poisoning one native output.
 * @param mode - Poison mode from one through five.
 */
export const assertPhpRecursivePoison = (observation, mode) => {
	assert.deepEqual(observation, {
		mode
		, checks: mode === 5 ? 206 : 207
		, layoutChecks: 170
		, poisoned: 1
		, liveIdentities: 0
		, liveNativeAllocations: 0
		, retirements: mode === 3 ? 0 : 1
	});
};

/**
 * Require pointer ownership before decoding, and named failure for the mutant.
 *
 * @param observation - JSON emitted by the direct trampoline probe.
 * @param mutant - Whether replies were deliberately released too soon.
 */
export const assertPhpRecursiveOwnership = (observation, mutant) => {
	assert.deepEqual(observation, {
		checks: mutant ? 214 : 202
		, valid: mutant ? 1 : 9
		, expiredContexts: 27
		, errors: mutant ? shapes.filter(shape => shape !== 'option') : []
		, checkedBeforeDecode: true
		, liveIdentities: 0
	});
};

/**
 * Require real fork rejection, generational identity safety and bounded recovery.
 *
 * @param observation - JSON emitted by the unchanged installed package.
 */
export const assertPhpRecursiveLifetimes = observation => {
	assert.deepEqual(observation, {
		checks: 8232
		, capacity: 4096
		, recovered: 8192
		, liveIdentities: 0
		, actualFork: true
		, simulatedFork: false
		, staleGenerationRejected: true
		, gcCleanup: true
		, fiberInvocationRejected: true
		, fiberCloseAllowed: true
	});
};
