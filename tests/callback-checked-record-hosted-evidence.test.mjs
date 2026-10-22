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

test("retained native callback checked-record evidence replays", async () => {
	const index = await checkCallbackCheckedRecordHostedEvidence(
		"native", "docs/evidence/callback-checked-record-native-20261022"
	);
	assert.deepEqual(index.accepted.profiles, ["c", "cpp"]);
	assert.deepEqual(index.accepted.routes, ["ordinary", "reviewed"]);
	assert.equal(index.accepted.reports, 4);
});

test("retained browser callback checked-record evidence replays", async () => {
	const index = await checkCallbackCheckedRecordHostedEvidence(
		"browser", "docs/evidence/callback-checked-record-browser-20261022"
	);
	assert.equal(index.accepted.nodeAccepted, true);
	assert.equal(index.accepted.browserAccepted, true);
	assert.deepEqual(index.accepted.engines, ["chromium", "firefox", "webkit"]);
	assert.deepEqual(index.accepted.routes, ["ordinary", "reviewed"]);
	assert.equal(index.accepted.records.browserReportCount, 6);
	assert.equal(index.accepted.records.archiveCount, 4);
});

for(const [lane, profiles, reports] of [
	["dotnet", ["dotnet"], 2]
	, ["jvm", ["java", "kotlin"], 4]
	, ["php-native", ["php-native"], 2]
	, ["wit-wasi", ["wit-wasi"], 2]
]) test(`retained ${lane} callback checked-record evidence replays`, async () => {
	const index = await checkCallbackCheckedRecordHostedEvidence(
		lane, `docs/evidence/callback-checked-record-${lane}-20261022`
	);
	assert.deepEqual(index.accepted.profiles, profiles);
	assert.deepEqual(index.accepted.routes, ["ordinary", "reviewed"]);
	assert.equal(index.accepted.reports, reports);
});
