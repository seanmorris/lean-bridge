/**
 * Replay the immutable complete optional-parameter hosted archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	checkOptionalParameterHostedEvidence
} from "./helpers/optional-parameter-hosted-evidence.mjs";

test("complete optional-parameter evidence authenticates every hosted lane"
	, async () => {
		const checked = await checkOptionalParameterHostedEvidence();
		assert.equal(checked.hostedAcceptance, true);
		assert.equal(checked.supportPromoted, false);
		assert.equal(checked.cells, 34);
		assert.equal(checked.lanes.length, 10);
		assert.equal(checked.artifacts.length, 11);
		assert.equal(checked.limitations.length, 4);
	}
);
