/**
 * Producer resource admission records for nested checked-record Rust acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";

export const nestedCheckedRecordRustLoadCeiling = 8;
export const nestedCheckedRecordRustLoadCeilings = Object.freeze([8, 12, 16, 20]);

/**
 * Require bounded waits that end on the first admitted sample.
 *
 * @param resource - One original resource wait record.
 * @param maxLoad - Exclusive host-load ceiling selected by the producer.
 */
export const assertNestedCheckedRecordRustResources = (resource, maxLoad = nestedCheckedRecordRustLoadCeiling) => {
	assert.ok(nestedCheckedRecordRustLoadCeilings.includes(maxLoad));
	assert.deepEqual(Object.keys(resource).sort(), ["observations", "waits"]);
	assert.ok(Number.isSafeInteger(resource.waits) && resource.waits >= 0 && resource.waits <= 20);
	assert.equal(resource.observations.length, resource.waits + 1);
	for(const [index, sample] of resource.observations.entries())
	{
		assert.deepEqual(Object.keys(sample).sort(), ["availableBytes", "freeBytes", "load"]);
		for(const key of ["availableBytes", "freeBytes"])
			assert.ok(Number.isSafeInteger(sample[key]) && sample[key] >= 2 * 1024 ** 3);
		assert.ok(Number.isFinite(sample.load) && sample.load >= 0);
		assert.equal(sample.load < maxLoad, index === resource.waits);
	}
};
