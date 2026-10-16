/**
 * Bounded producer admission for recursive checked-record Perl acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { waitNominalSubtypeDotnetResources } from "./nominal-subtype-dotnet-resources.mjs";

export const recursiveCheckedRecordPerlLoadCeilings = Object.freeze([8, 12, 16, 20]);
export const recursiveCheckedRecordPerlLoadCeiling = 8;

/**
 * Require every sample to preserve disk/memory floors and the final load ceiling.
 *
 * @param record - Complete resource sampling record.
 * @param maxLoad - Exclusive approved load ceiling.
 */
export const assertRecursiveCheckedRecordPerlResources = (record, maxLoad) => {
	assert.ok(recursiveCheckedRecordPerlLoadCeilings.includes(maxLoad));
	assert.deepEqual(Object.keys(record).sort(), ["observations", "waits"]);
	assert.ok(Number.isSafeInteger(record.waits) && record.waits >= 0
		&& record.waits <= 20);
	assert.equal(record.observations.length, record.waits + 1);
	for(const [index, value] of record.observations.entries())
	{
		assert.deepEqual(Object.keys(value).sort()
			, ["availableBytes", "freeBytes", "load"]);
		assert.ok(value.freeBytes >= 2 * 1024 ** 3);
		assert.ok(value.availableBytes >= 2 * 1024 ** 3);
		assert.ok(Number.isFinite(value.load) && value.load >= 0);
		if(index < record.observations.length - 1) assert.ok(value.load >= maxLoad);
		else assert.ok(value.load < maxLoad);
	}
	return record;
};

/**
 * Wait at the approved ceiling without relaxing disk or memory floors.
 *
 * @param root - Existing task-owned output root.
 * @param root0 - Optional admission policy.
 * @param root0.maxLoad - Exclusive approved load ceiling.
 * @param root0.notify - Diagnostic sink for bounded waits.
 */
export const waitRecursiveCheckedRecordPerlResources = async (
	root, { maxLoad = recursiveCheckedRecordPerlLoadCeiling, notify = () => {} } = {}
) => assertRecursiveCheckedRecordPerlResources(
	await waitNominalSubtypeDotnetResources(root, { maxLoad, notify }), maxLoad
);
