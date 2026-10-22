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

test("retained languages callback checked-record evidence replays", async () => {
	const index = await checkCallbackCheckedRecordHostedEvidence(
		"languages"
		, "docs/evidence/callback-checked-record-languages-20261022"
	);
	assert.deepEqual(index.accepted.profiles, ["python", "ruby", "rust"]);
	assert.deepEqual(index.accepted.routes, ["ordinary", "reviewed"]);
	assert.equal(index.accepted.reports, 6);
});

test("retained perl callback checked-record evidence replays", async () => {
	const index = await checkCallbackCheckedRecordHostedEvidence(
		"perl", "docs/evidence/callback-checked-record-perl-20261022"
	);
	assert.equal(index.accepted.interpreterCount, 4);
	assert.deepEqual(index.accepted.modes, ["prebuilt-only", "build-xs"]);
	assert.deepEqual(index.accepted.routes, ["ordinary", "reviewed"]);
	assert.equal(index.accepted.reports, 16);
});
