/**
 * Authenticate the exact PHP-Wasm callback-refinement promotion history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeCallbackRefinementsPhpWasmPromotionSource
	, callbackRefinementsPhpWasmPromotionAddedPaths
	, callbackRefinementsPhpWasmPromotionCommit
	, callbackRefinementsPhpWasmPromotionHistoryAddedPaths
	, callbackRefinementsPhpWasmPromotionHistoryPath
	, callbackRefinementsPhpWasmPromotionIntegrationPaths
	, callbackRefinementsPhpWasmPromotionPredecessor
	, callbackRefinementsPhpWasmPromotionUpdatedPaths
	, reverseCallbackRefinementsPhpWasmPromotionIntegration
	, reverseCallbackRefinementsPhpWasmPromotionUpdate
} from "./callback-refinements-php-wasm-promotion-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	callbackRefinementsPhpWasmPromotionHistoryPath, "utf8"));

test("PHP-Wasm callback-refinement promotion history restores every source", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "callback-refinements-php-wasm-promotion-v1");
	assert.equal(history.predecessorCommit
		, callbackRefinementsPhpWasmPromotionPredecessor);
	assert.equal(history.promotionCommit
		, callbackRefinementsPhpWasmPromotionCommit);
	assert.deepEqual(history.promotionUpdates.map(item => item.path)
		, callbackRefinementsPhpWasmPromotionUpdatedPaths);
	for(const update of history.promotionUpdates)
	{
		const current = git(["show"
			, `${callbackRefinementsPhpWasmPromotionCommit}:${update.path}`]);
		const previous = git(["show"
			, `${callbackRefinementsPhpWasmPromotionPredecessor}:${update.path}`]);
		assert.equal(reverseCallbackRefinementsPhpWasmPromotionUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, callbackRefinementsPhpWasmPromotionIntegrationPaths);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		assert.equal(reverseCallbackRefinementsPhpWasmPromotionIntegration(
			current, update), git(["show"
			, `${callbackRefinementsPhpWasmPromotionCommit}:${update.path}`])
		, update.path);
	}
});

test("PHP-Wasm callback-refinement promotion history closes additions and cells", async () => {
	const history = await record();
	assert.deepEqual(history.promotionAdditions.map(item => item.path)
		, callbackRefinementsPhpWasmPromotionAddedPaths);
	for(const addition of history.promotionAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${callbackRefinementsPhpWasmPromotionPredecessor}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(git(["show"
			, `${callbackRefinementsPhpWasmPromotionCommit}:${addition.path}`]))
		, addition.currentSha256, addition.path);
	}
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, callbackRefinementsPhpWasmPromotionHistoryAddedPaths);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
	const surface = JSON.parse(git(["show"
		, `${callbackRefinementsPhpWasmPromotionCommit}:docs/type-surface.v1.json`]));
	assert.equal(surface.evidence.filter(item =>
		item.id === "callback-refinements-php-wasm-hosted-installed").length, 1);
	assert.deepEqual(surface.observations.filter(item =>
		/^callback-(?:fin|checked-record)-php-wasm-/u.test(item.id))
		.map(item => item.id)
		, [
		"callback-fin-php-wasm-ordinary"
		, "callback-checked-record-php-wasm-ordinary"
		, "callback-fin-php-wasm-reviewed"
		, "callback-checked-record-php-wasm-reviewed"
		]
	);
});

test("PHP-Wasm callback-refinement promotion history rejects alteration", async () => {
	const history = await record();
	const update = structuredClone(history.promotionUpdates[0]);
	const current = git(["show"
		, `${callbackRefinementsPhpWasmPromotionCommit}:${update.path}`]);
	assert.throws(() => reverseCallbackRefinementsPhpWasmPromotionUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseCallbackRefinementsPhpWasmPromotionUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.throws(() => reverseCallbackRefinementsPhpWasmPromotionUpdate(
		current, { ...update, path: "package.json" }));
	const unrelated = `${current}\n<!-- unrelated -->\n`;
	assert.equal(beforeCallbackRefinementsPhpWasmPromotionSource(
		update.path, unrelated), unrelated);
});

test("PHP-Wasm callback-refinement promotion history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-callback-refinement-promotion-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-refinements-php-wasm-promotion-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact promotion commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
