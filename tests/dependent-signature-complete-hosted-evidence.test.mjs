/**
 * Replay the immutable complete dependent-signature hosted archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	checkDependentSignatureHostedEvidence
} from "./helpers/dependent-signature-hosted-evidence.mjs";

test("complete dependent-signature evidence authenticates every hosted lane"
	, async () => {
		const checked = await checkDependentSignatureHostedEvidence();
		assert.deepEqual(checked.matrix, {
			lanes: 11, profiles: 17, authorRoutes: 2, apiModes: 2
			, reports: 44, cells: 34
		});
		assert.equal(checked.lanes.length, 11);
		assert.equal(checked.aggregate.receipt.records.length, 44);
		assert.equal(checked.limitations.length, 5);
	}
);
