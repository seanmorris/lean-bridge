/**
 * Keep Ruby callback ownership upgrades separate from prior acceptance records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedDotnetCallbackResults } from "./helpers/owned-dotnet-callback-result-history.mjs";
import { generateOwnedRubyPackage } from "../src/backends/ruby/owned-package.mjs";
import { historicalOwnedRubyCallbackPackage } from "./helpers/owned-ruby-callback-generated-history.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedRubyCallbackResultReviewedIr } from "./helpers/owned-ruby-callback-result-fixture.mjs";
import { ownedRubyCallbackHistoryPath, ownedRubyCallbackHistorySha256
	, ownedRubyCallbackBaseline, ownedRubyCallbackChangedPaths
	, beforeOwnedRubyCallbackResults, reverseOwnedRubyCallbackUpdate } from "./helpers/owned-ruby-callback-result-history.mjs";

test("Ruby callback history authenticates exact source transitions and rejects partial edits", async () => {
	const bytes = await readFile(ownedRubyCallbackHistoryPath);
	assert.equal(sha256(bytes), ownedRubyCallbackHistorySha256);
	const history = JSON.parse(bytes);
	assert.equal(history.baselineRevision, ownedRubyCallbackBaseline);
	assert.equal(sha256(await readFile(history.previous.path)), history.previous.sha256);
	assert.deepEqual(history.updates.map(update => update.path), ownedRubyCallbackChangedPaths);
	for(const update of history.updates)
	{
		// The hub reverses every recognized state, so live reads and predecessor reads name their stops.
		const current = Buffer.from(beforeOwnedDotnetCallbackResults(update.path, await readFile(update.path), update.currentSha256));
		const prior = beforeOwnedRubyCallbackResults(update.path, current, update.previousSha256);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforeOwnedRubyCallbackResults(update.path, current, update.currentSha256), current);
		assert.equal(beforeOwnedRubyCallbackResults(update.path, prior, update.previousSha256), prior);
		for(const unknown of [current + "\n", current + current, ""])
		{
			assert.equal(beforeOwnedRubyCallbackResults(update.path, unknown), unknown);
			assert.throws(() => reverseOwnedRubyCallbackUpdate(unknown, update));
		}
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, currentSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedRubyCallbackUpdate(current, changed));
		assert.equal(beforeOwnedRubyCallbackResults("unknown.mjs", current), current);
	}
});

test("Ruby historical generation preserves exact legacy files and rejects callback-result contracts", () => {
	const ir = ownedAggregateReviewedIr(), current = generateOwnedRubyPackage(ir);
	const saved = structuredClone(current.files), prior = historicalOwnedRubyCallbackPackage(ir);
	const runtime = `lib/${current.requirePath}/owned.rb`;
	assert.match(current.files[runtime], /@thread = nil/u);
	assert.doesNotMatch(prior.files[runtime], /@thread = nil/u);
	assert.notEqual(current.contract.runtimeSha256, prior.contract.runtimeSha256);
	assert.deepEqual({ ...prior.contract, runtimeSha256: current.contract.runtimeSha256 }, current.contract);
	for(const path of Object.keys(current.files).filter(path => ![runtime, "binding-manifest.json"].includes(path)))
		assert.equal(prior.files[path], current.files[path], path);
	assert.deepEqual(current.files, saved);
	assert.throws(() => historicalOwnedRubyCallbackPackage(ownedRubyCallbackResultReviewedIr(), null,
		{ callbackResultAnchors: true }), /cannot accept callback-result packages/u);
});

test("Ruby callback source identities do not promote unrelated type-surface cells", async () => {
	const path = "docs/type-surface.v1.json", history = JSON.parse(await readFile(ownedRubyCallbackHistoryPath, "utf8"));
	const transition = history.updates.find(update => update.path === path);
	assert.ok(transition, "Ruby callback history records an explicit type-surface predecessor");
	const current = beforeOwnedDotnetCallbackResults(path, await readFile(path, "utf8"), transition.currentSha256);
	const previous = JSON.parse(beforeOwnedRubyCallbackResults(path, current, transition.previousSha256));
	// Source pins compare against the milestone inventory's own pins, never later live bytes.
	const pins = new Map();
	for(const evidence of JSON.parse(current).evidence) for(const file of evidence.files)
	{
		assert.ok(!pins.has(file.path) || pins.get(file.path) === file.sha256, file.path);
		pins.set(file.path, file.sha256);
	}
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		assert.ok(pins.has(file.path), file.path);
		file.sha256 = pins.get(file.path);
	}
	assert.deepEqual(JSON.parse(current), previous);
	const binary = Buffer.from([0, 255, 128, 192]);
	assert.equal(beforeOwnedRubyCallbackResults("unrelated.bin", binary), binary);
});
