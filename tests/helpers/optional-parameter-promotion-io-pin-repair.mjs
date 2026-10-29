/**
 * Repair the live source pins missed when optional-parameter publication
 * changed the bounded type-surface promotion reader.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	reconcileDependentCheckedRecordSourcePins
} from "./dependent-checked-record-promotion.mjs";

export const optionalParameterPromotionIoPath
	= "tests/helpers/type-surface-promotion-io.mjs";
export const optionalParameterPromotionIoPreviousSha256
	= "89c4b392fbf482e453e48552de977790a783691ee7f28dba07bf58ec5c0db296";
export const optionalParameterPromotionIoRepairPredecessor
	= "21a101e02bc49809a73e9c085b88ff14e127f3e4";

/**
 * Refresh exactly the stale live pins for the promotion reader.
 *
 * @param inventory - Complete pre-repair type-surface inventory.
 * @param currentSha256 - Exact current promotion-reader digest.
 */
export const repairOptionalParameterPromotionIoPins = (
	inventory, currentSha256
) => {
	assert.match(currentSha256, /^[a-f0-9]{64}$/u);
	assert.notEqual(currentSha256, optionalParameterPromotionIoPreviousSha256);
	const references = inventory.evidence.flatMap(evidence =>
		evidence.files.filter(file => file.path === optionalParameterPromotionIoPath)
			.map(file => ({ evidence: evidence.id, sha256: file.sha256 })));
	assert.equal(references.length, 34);
	assert.equal(references.filter(reference => reference.sha256
		=== optionalParameterPromotionIoPreviousSha256).length, 33);
	assert.equal(references.filter(reference => reference.sha256
		=== currentSha256).length, 1);
	assert.ok(references.every(reference => [
		optionalParameterPromotionIoPreviousSha256, currentSha256
	].includes(reference.sha256)));
	const repaired = reconcileDependentCheckedRecordSourcePins(
		inventory, new Map([[optionalParameterPromotionIoPath, currentSha256]]));
	assert.equal(repaired.refreshed, 33);
	const after = repaired.inventory.evidence.flatMap(evidence =>
		evidence.files.filter(file => file.path === optionalParameterPromotionIoPath));
	assert.equal(after.length, 34);
	assert.ok(after.every(file => file.sha256 === currentSha256));
	return repaired.inventory;
};
