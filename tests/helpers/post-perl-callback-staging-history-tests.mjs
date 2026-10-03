/**
 * Preserve completed Perl receipts across the exact staged PHP and WIT lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeWitCallbackRuntimeStaging } from "./wit-callback-runtime-staging-history.mjs";
import { beforePostPerlCallbackStaging, postPerlCallbackChangedPaths
	, postPerlCallbackHistoryPath, postPerlCallbackHistorySha256
	, readPostPerlCallbackHistory, reversePostPerlCallbackUpdate } from "./post-perl-callback-staging-history.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { assertOwnedPerlCallbackReport, ownedPerlCallbackEvidencePath } from "./owned-perl-callback-result-acceptance.mjs";

test("post-Perl callback staging reverses complete registered bytes and preserves unknown inputs", async t => {
	const bytes = await readFile(postPerlCallbackHistoryPath);
	assert.equal(sha256(bytes), postPerlCallbackHistorySha256);
	const history = readPostPerlCallbackHistory();
	assert.deepEqual(history.updates.map(update => update.path), postPerlCallbackChangedPaths);
	let rejected = 0;
	for(const update of history.updates)
	{
		const current = Buffer.from(beforeWitCallbackRuntimeStaging(update.path, await readFile(update.path)));
		const prior = beforePostPerlCallbackStaging(update.path, current);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforePostPerlCallbackStaging(update.path, current, update.currentSha256), current);
		assert.equal(beforePostPerlCallbackStaging(update.path, prior), prior);
		for(const unknown of [current + "\n", current + current, "", Buffer.from([0, 255, 128, 192])])
		{
			assert.equal(beforePostPerlCallbackStaging(update.path, unknown), unknown);
			assert.throws(() => reversePostPerlCallbackUpdate(unknown, update)); rejected++;
		}
		const changes = [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, currentSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, edits: [{ ...update.edits[0], start: update.edits[0].start + 1 }] }
			, { ...update, extra: true }];
		for(const change of changes)
		{
			assert.throws(() => reversePostPerlCallbackUpdate(current, change)); rejected++;
		}
		assert.equal(beforePostPerlCallbackStaging("unknown.mjs", current), current);
	}
	for(const [path, identity] of Object.entries(history.introducedSources))
	{
		assert.equal(sha256(beforeWitCallbackRuntimeStaging(path, await readFile(path))), identity.currentSha256);
		assert.equal(identity.currentSha256, identity.integratedSha256);
		const current = Buffer.from(beforeWitCallbackRuntimeStaging(path, await readFile(path)));
		assert.equal(beforePostPerlCallbackStaging(path, current), current);
	}
	t.diagnostic(`${history.updates.length} exact transitions, ${Object.keys(history.introducedSources).length} introduced inputs, ${rejected} rejected source forgeries.`);
});

test("post-Perl staging preserves completed receipts and type-surface support while registering readers", async () => {
	const history = readPostPerlCallbackHistory();
	for(const predecessor of [history.previous, history.completedPredecessor])
		assert.equal(sha256(await readFile(predecessor.path)), predecessor.sha256);
	const path = "docs/type-surface.v1.json", current = await readFile(path, "utf8");
	const prior = JSON.parse(beforePostPerlCallbackStaging(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files)
		file.sha256 = sha256(beforeWitCallbackRuntimeStaging(file.path, await readFile(file.path)));
	assert.deepEqual(JSON.parse(current), prior);
	const wrapper = await readFile("tests/owned-jvm-callback-result-history.test.mjs", "utf8");
	assert.match(wrapper, /^import "\.\/helpers\/post-perl-callback-staging-history-tests\.mjs";$/mu);
	assert.match(wrapper, /^import "\.\/helpers\/owned-php-callback-result-runtime-evidence-tests\.mjs";$/mu);
});

test("frozen Perl CLI observations reject current staged PHP and WIT inventories unchanged", async () => {
	const record = JSON.parse(await readFile(ownedPerlCallbackEvidencePath, "utf8"));
	const reports = unpackOwnedCallbackReports(record.archive);
	const selected = Object.keys(reports).filter(path => /ordinary-combined-(?:package|release)\.json$/u.test(path));
	assert.equal(selected.length, 2);
	for(const path of selected)
	{
		const item = reports[path], original = structuredClone(item);
		await assert.rejects(() => assertOwnedPerlCallbackReport(path, item), error => {
			assert.equal(error.code, "ERR_ASSERTION"); return true;
		});
		assert.deepEqual(item, original);
	}
});
