/**
 * Replay the immutable complete direct proof-erasure hosted archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	checkDirectProofErasureHostedEvidence
} from "./helpers/direct-proof-erasure-hosted-evidence.mjs";

test("complete direct proof-erasure evidence authenticates every hosted lane"
	, async () => {
		const checked = await checkDirectProofErasureHostedEvidence();
		assert.equal(checked.hostedAcceptance, true);
		assert.equal(checked.supportPromoted, false);
		assert.equal(checked.cells, 204);
		assert.equal(checked.lanes.length, 10);
		assert.equal(checked.artifacts.length, 10);
		assert.equal(checked.limitations.length, 4);
	}
);
