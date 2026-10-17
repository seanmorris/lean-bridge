/**
 * Resource admission policy for recursive checked-record Rust package evidence.
 *
 * @file
 */
import assert from "node:assert/strict";

export const recursiveCheckedRecordRustLoadCeiling = 8;
export const recursiveCheckedRecordRustLoadCeilings = Object.freeze([8, 12, 16, 20]);

/**
 * Validate the observations retained by a producer before expensive compilation.
 *
 * @param record - Resource observations and wait count.
 * @param maxLoad - Explicit approved one-minute load ceiling.
 */
export const assertRecursiveCheckedRecordRustResources = (record, maxLoad) => {
	assert.ok(recursiveCheckedRecordRustLoadCeilings.includes(maxLoad));
	assert.deepEqual(Object.keys(record).sort(), ["observations", "waits"]);
	assert.ok(Array.isArray(record.observations) && record.observations.length > 0);
	assert.equal(record.waits, record.observations.length - 1);
	for(const [index, observation] of record.observations.entries())
	{
		assert.deepEqual(Object.keys(observation).sort(), ["availableBytes", "freeBytes", "load"]);
		for(const key of ["availableBytes", "freeBytes", "load"])
			assert.ok(Number.isFinite(observation[key]) && observation[key] >= 0);
		if(index === record.observations.length - 1)
		{
			assert.ok(observation.freeBytes >= 2 * 1024 ** 3);
			assert.ok(observation.availableBytes >= 2 * 1024 ** 3);
			assert.ok(observation.load < maxLoad);
		}
	}
};
