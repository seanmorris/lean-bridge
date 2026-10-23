/**
 * Replay every immutable hosted dependent checked-record lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	dependentCheckedRecordPromotionReferences
	, loadDependentCheckedRecordVerifiers
} from "./helpers/dependent-checked-record-promotion.mjs";
import "./helpers/dependent-checked-record-matrix-ci-tests.mjs";
import "./dependent-checked-record-promotion.test.mjs";

test("dependent checked-record matrix replays all eleven immutable archives"
	, async () => {
	const references = await dependentCheckedRecordPromotionReferences(
		await loadDependentCheckedRecordVerifiers());
	assert.equal(references.length, 44);
	}
);
