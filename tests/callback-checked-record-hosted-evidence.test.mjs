/**
 * Replay every retained callback checked-record hosted archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	checkCallbackCheckedRecordHostedEvidence
} from "./helpers/callback-checked-record-hosted-evidence.mjs";

test("retained language callback checked-record evidence replays", async () => {
	const index = await checkCallbackCheckedRecordHostedEvidence(
		"languages"
		, "docs/evidence/callback-checked-record-languages-20261022"
	);
	assert.deepEqual(index.accepted.profiles, ["python", "ruby", "rust"]);
	assert.deepEqual(index.accepted.routes, ["ordinary", "reviewed"]);
	assert.equal(index.accepted.reports, 6);
});
