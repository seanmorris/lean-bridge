/**
 * Exercise exact WIT lineage reversal without accepting excluded Perl successors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforePerlCallbackVariants } from "./owned-perl-callback-result-variant-history.mjs";
import { beforeCopiedFixtureReaders, copiedFixtureReaderPaths } from "./copied-fixture-source-history.mjs";
import { beforePostPerlCallbackStaging, readPostPerlCallbackHistory } from "./post-perl-callback-staging-history.mjs";
import { assertWitCallbackRuntimeHistory, beforeWitCallbackRuntimeStaging
	, readWitCallbackRuntimeHistory, reverseWitCallbackRuntimeUpdate
	, witCallbackRuntimeHistoryPath, witCallbackRuntimeHistorySha256
	, witCallbackRuntimeSourcePaths, witCallbackRuntimeReaderPaths
	, witCallbackRuntimeIntroducedPaths, witCallbackRuntimeSuccessorPaths } from "./wit-callback-runtime-staging-history.mjs";

test("WIT runtime staging closes both transition categories and rejects forged history", async t => {
	const bytes = await readFile(witCallbackRuntimeHistoryPath), history = readWitCallbackRuntimeHistory();
	assert.equal(sha256(bytes), witCallbackRuntimeHistorySha256);
	assert.deepEqual(JSON.parse(bytes), history); assertWitCallbackRuntimeHistory(history);
	const changes = [
		item => { item.schemaVersion++; }, item => { item.kind += "-forged"; }
		, item => { item.baselineRevision = "0".repeat(40); }
		, item => { item.integrationRevision = item.lineage.at(-1); }
		, item => { item.lineage.reverse(); }, item => { item.lineage.pop(); }
		, item => { item.lineage.push(item.lineage[0]); }
		, item => { item.previous.sha256 = "0".repeat(64); }
		, item => { item.previous.path = "unrelated.json"; }
		, item => { item.acceptance = "passed"; }
		, item => { item.scope = { installedPackage: true }; }
		, item => { item.updates[0].path = witCallbackRuntimeSuccessorPaths[0]; }
		, item => { item.readerUpdates[0].path = item.updates[0].path; }
		, item => { item.updates.push(item.readerUpdates[0]); }
		, item => { item.readerUpdates.push(item.updates[0]); }
		, ...["updates", "readerUpdates"].flatMap(category => [
			item => { item[category].pop(); }, item => { item[category].reverse(); }
			, item => { item[category].push(item[category][0]); }
			, item => { item[category][0].currentSha256 = "partial"; }
			, item => { item[category][0].previousSha256 = item[category][0].currentSha256; }
			, item => { item[category][0].strategy = "replace-all"; }
			, item => { item[category][0].edits = []; }
			, item => { item[category][0].extra = true; }
			, item => { item[category][0].edits[0].start = -1; }
			, item => { item[category][0].edits[0].start = 0.5; }
			, item => { item[category][0].edits[0].previous = item[category][0].edits[0].current; }
			, item => { item[category][0].edits[0].extra = true; }
			, item => { item[category][0].edits.push(item[category][0].edits[0]); }
		])
		, item => { delete item.introducedSources[witCallbackRuntimeIntroducedPaths[0]]; }
		, item => { item.introducedSources["unknown.mjs"] = { currentSha256: "a".repeat(64), integratedSha256: "a".repeat(64) }; }
		, item => { item.introducedSources[witCallbackRuntimeIntroducedPaths[0]].integratedSha256 = "0".repeat(64); }
		, item => { delete item.successorInputs[witCallbackRuntimeSuccessorPaths[0]]; }
		, item => { item.successorInputs[item.updates[0].path] = { sha256: "a".repeat(64) }; }
		, item => { item.successorInputs[witCallbackRuntimeSuccessorPaths[0]].sha256 = "partial"; }
		, item => { item.successorInputs[witCallbackRuntimeSuccessorPaths[0]].accept = true; }
	];
	for(const change of changes)
	{
		const altered = structuredClone(history); change(altered);
		assert.throws(() => assertWitCallbackRuntimeHistory(altered), String(change));
	}
	t.diagnostic(`${changes.length} closed ledger mutations rejected.`);
});

test("WIT runtime staging authenticates complete source bytes and preserves stopping identities", async t => {
	const history = readWitCallbackRuntimeHistory(); let rejected = 0;
	for(const category of ["readerUpdates", "updates"]) for(const update of history[category])
	{
		const current = Buffer.from(beforePerlCallbackVariants(update.path, await readFile(update.path), update.currentSha256));
		const prior = reverseWitCallbackRuntimeUpdate(current, update, category);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforeWitCallbackRuntimeStaging(update.path, current, update.currentSha256), current);
		assert.equal(beforeWitCallbackRuntimeStaging(update.path, current, update.previousSha256), prior);
		assert.equal(beforeWitCallbackRuntimeStaging(update.path, prior), prior);
		for(const unknown of [current + "\n", current + current, "", Buffer.from([0, 255, 128, 192])])
		{
			assert.equal(beforeWitCallbackRuntimeStaging(update.path, unknown), unknown);
			assert.throws(() => reverseWitCallbackRuntimeUpdate(unknown, update, category)); rejected++;
		}
		const changes = [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, currentSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, edits: [{ ...update.edits[0], start: update.edits[0].start + 1 }] }
			, { ...update, extra: true }];
		for(const changed of changes)
		{
			assert.throws(() => reverseWitCallbackRuntimeUpdate(current, changed, category)); rejected++;
		}
		assert.throws(() => reverseWitCallbackRuntimeUpdate(current, update, category === "updates" ? "readerUpdates" : "updates")); rejected++;
		assert.equal(beforeWitCallbackRuntimeStaging("unknown.mjs", current), current);
	}
	for(const [path, identity] of Object.entries(history.introducedSources))
	{
		const bytes = await readFile(path); assert.equal(sha256(bytes), identity.currentSha256);
		assert.equal(identity.currentSha256, identity.integratedSha256);
		assert.equal(beforeWitCallbackRuntimeStaging(path, bytes), bytes);
	}
	assert.equal(rejected, 132);
	t.diagnostic(`5 WIT transitions, 6 reader hooks, 5 introduced sources, ${rejected} rejected source forgeries.`);
});

test("WIT runtime staging composes latest-first into post-Perl and copied readers", async () => {
	const history = readWitCallbackRuntimeHistory(), previous = readPostPerlCallbackHistory();
	assert.equal(sha256(await readFile(history.previous.path)), history.previous.sha256);
	for(const path of [...witCallbackRuntimeSourcePaths, ...witCallbackRuntimeReaderPaths])
	{
		assert.ok(copiedFixtureReaderPaths.includes(path));
		const current = await readFile(path), stage = beforeWitCallbackRuntimeStaging(path, current);
		const old = previous.updates.find(update => update.path === path);
		const expected = old?.previousSha256 ?? sha256(stage);
		if(old) assert.equal(sha256(stage), old.currentSha256, path);
		assert.equal(sha256(beforePostPerlCallbackStaging(path, current)), expected, path);
		assert.equal(beforePostPerlCallbackStaging(path, current, sha256(current)), current);
		assert.equal(sha256(beforePostPerlCallbackStaging(path, current, sha256(stage))), sha256(stage));
		assert.equal(sha256(beforeCopiedFixtureReaders(path, current, expected)), expected, path);
		const drift = Buffer.concat([current, Buffer.from("\n")]);
		assert.equal(beforeCopiedFixtureReaders(path, drift, expected), drift);
	}
	const introduced = previous.introducedSources["tests/wit-owned-callback-results.test.mjs"];
	assert.equal(sha256(beforeWitCallbackRuntimeStaging("tests/wit-owned-callback-results.test.mjs",
		await readFile("tests/wit-owned-callback-results.test.mjs"))), introduced.currentSha256);
	const wrapper = await readFile("tests/owned-jvm-callback-result-history.test.mjs", "utf8");
	assert.match(wrapper, /^import "\.\/helpers\/wit-callback-runtime-staging-history-tests\.mjs";$/mu);
});

test("frozen WIT runtime stage excludes Perl successors now closed by a separate extension", async () => {
	const history = readWitCallbackRuntimeHistory();
	for(const path of witCallbackRuntimeSuccessorPaths)
	{
		const expected = history.successorInputs[path].sha256;
		const current = beforePerlCallbackVariants(path, await readFile(path), expected);
		assert.equal(sha256(current), expected, path);
		assert.equal(beforeWitCallbackRuntimeStaging(path, current, expected), current);
		assert.equal(beforePostPerlCallbackStaging(path, current, expected), current);
		assert.equal(beforeCopiedFixtureReaders(path, current, expected), current);
		assert.ok(!history.updates.some(update => update.path === path));
		assert.ok(!history.readerUpdates.some(update => update.path === path));
		assert.equal(history.introducedSources[path], undefined);
		assert.throws(() => reverseWitCallbackRuntimeUpdate(current, { ...history.updates[0], path }));
	}
});
