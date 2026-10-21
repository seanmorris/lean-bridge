/**
 * Producer resource admission records for dependent checked-record Rust acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";

export const dependentCheckedRecordRustLoadCeilings = Object.freeze([6, 8, 12, 16]);

/**
 * Require bounded waits that end on the first admitted sample.
 *
 * @param resource - One original resource wait record.
 * @param maxLoad - Exclusive host-load ceiling selected by the producer.
 */
export const assertDependentCheckedRecordRustResources = (resource, maxLoad) => {
	assert.ok(dependentCheckedRecordRustLoadCeilings.includes(maxLoad));
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
