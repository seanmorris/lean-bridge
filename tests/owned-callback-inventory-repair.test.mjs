/**
 * Authenticate the CLI allowlist repair without changing accepted callback runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedCppCallbackResults } from "./helpers/owned-cpp-callback-result-history.mjs";
import { callbackInventoryHistoryPath, callbackInventoryHistorySha256
	, readCallbackInventoryHistory, beforeCallbackInventoryRepair
	, reverseCallbackInventoryUpdate } from "./helpers/owned-callback-inventory-history.mjs";
import { ownedPhpReceiverModel } from "./helpers/owned-php-receiver-evidence.mjs";
import { assertOwnedJvmReceiverPackage } from "./helpers/owned-jvm-receiver-package-evidence.mjs";

test("callback inventory repair preserves complete source and acceptance identities", async () => {
	const bytes = await readFile(callbackInventoryHistoryPath);
	assert.equal(sha256(bytes), callbackInventoryHistorySha256);
	const history = readCallbackInventoryHistory();
	const accepted = JSON.parse(await readFile(history.previous.path, "utf8"));
	assert.deepEqual(history.updates.map(item => item.path), [
		"docs/type-surface.v1.json", "nix/component-engine-source-boundary.json"
		, "package.json", "src/adoption/test-profiles.mjs"
		, "tests/helpers/copied-fixture-source-history.mjs"
		, "tests/helpers/owned-callback-result-evidence.mjs"
		, "tests/helpers/owned-callback-result-history.mjs"
		, "tests/helpers/owned-jvm-receiver-package-evidence.mjs"
		, "tests/helpers/owned-php-receiver-evidence.mjs"
		, "tests/helpers/owned-php-receiver-package-evidence.mjs"
		, "tests/owned-callback-result-history.test.mjs"
	]);
	for(const update of history.updates)
	{
		const current = beforeOwnedCppCallbackResults(update.path, await readFile(update.path), update.currentSha256);
		const prior = beforeCallbackInventoryRepair(update.path, current, update.previousSha256);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(update.previousSha256, accepted.sources[update.path], update.path);
		assert.equal(beforeCallbackInventoryRepair(update.path, current, update.currentSha256), current);
		assert.equal(beforeCallbackInventoryRepair(update.path, prior, update.previousSha256), prior);
		assert.equal(beforeCallbackInventoryRepair(update.path, current + "\n"), current + "\n");
		assert.equal(reverseCallbackInventoryUpdate(update.path, current, update), prior);
		assert.throws(() => reverseCallbackInventoryUpdate(update.path, current, {
			...update, previousSha256: "0".repeat(64)
		}));
	}
	const packageUpdate = history.updates.find(update => update.path === "package.json");
	const current = JSON.parse(beforeOwnedCppCallbackResults("package.json", await readFile("package.json"), packageUpdate.currentSha256));
	const prior = JSON.parse(beforeCallbackInventoryRepair("package.json", await readFile("package.json"), packageUpdate.previousSha256));
	prior.files.push("src/analyze/callback-signature.mjs"); prior.files.sort();
	assert.deepEqual(current, prior);
	const configuration = beforeOwnedCppCallbackResults("config/cli-package.v1.json", await readFile("config/cli-package.v1.json"), accepted.sources["config/cli-package.v1.json"]);
	assert.deepEqual(current.files, JSON.parse(configuration).files);
});

test("callback inventory repair refreshes source identities without changing support claims", async () => {
	const path = "docs/type-surface.v1.json", history = readCallbackInventoryHistory();
	const update = history.updates.find(item => item.path === path);
	const current = beforeOwnedCppCallbackResults(path, await readFile(path, "utf8"), update.currentSha256);
	const prior = JSON.parse(beforeCallbackInventoryRepair(path, current, update.previousSha256));
	for(const evidence of prior.evidence) for(const file of evidence.files)
	{
		const expected = history.updates.find(item => item.path === file.path)?.currentSha256 ?? file.sha256;
		file.sha256 = sha256(beforeOwnedCppCallbackResults(file.path, await readFile(file.path), expected));
	}
	assert.deepEqual(JSON.parse(current), prior);
});

test("callback inventory repair rejects substituted historical compiler identities", async () => {
	const current = sha256(await readFile("src/analyze/NativeExports.lean"));
	const php = JSON.parse(await readFile("docs/evidence/owned-php-receivers-20261001.json", "utf8"));
	const jvm = JSON.parse(await readFile("docs/evidence/owned-jvm-receivers-20261001.json", "utf8"));
	for(const [item, check] of [
		[php.runtime[0], value => ownedPhpReceiverModel(value)]
		, [jvm.packages[0], value => assertOwnedJvmReceiverPackage(value, { run: jvm.run })]
	]) {
		assert.notEqual(item.input.sourceIdentity.extractorSha256, current);
		await check(item);
		for(const digest of [current, "0".repeat(64)])
		{
			const changed = structuredClone(item);
			changed.input.sourceIdentity.extractorSha256 = digest;
			await assert.rejects(() => check(changed));
		}
	}
});
