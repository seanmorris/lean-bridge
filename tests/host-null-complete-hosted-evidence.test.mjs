/**
 * Replay the immutable complete HostNull hosted archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	checkHostNullCompleteHostedEvidence
} from "./helpers/host-null-complete-hosted-evidence.mjs";

test("complete HostNull evidence authenticates all seven hosted lanes"
	, async () => {
		const checked = await checkHostNullCompleteHostedEvidence();
		assert.equal(checked.hostedAcceptance, true);
		assert.equal(checked.supportPromoted, false);
		assert.equal(checked.cells.length, 170);
		assert.equal(checked.captures.length, 7);
		assert.equal(checked.limitations.length, 6);
		assert.ok(checked.files.length > 0);
	}
);
