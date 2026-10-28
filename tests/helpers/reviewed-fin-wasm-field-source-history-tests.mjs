/**
 * Authenticate the reviewed Wasm Fin-field source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
	beforeReviewedFinWasmFieldSource
	, reviewedFinWasmFieldAddedPaths
	, reviewedFinWasmFieldChangedPaths
	, reviewedFinWasmFieldHistoryPath
	, reviewedFinWasmFieldImplementation
	, reviewedFinWasmFieldIntegrationPaths
	, reviewedFinWasmFieldPins
	, reviewedFinWasmFieldPredecessor
	, reverseReviewedFinWasmFieldUpdate
} from "./reviewed-fin-wasm-field-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(reviewedFinWasmFieldHistoryPath));

test("reviewed Wasm Fin-field history retains the exact implementation and integration", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "reviewed-fin-wasm-field-source-v1");
	assert.equal(value.predecessorCommit, reviewedFinWasmFieldPredecessor);
	assert.equal(value.implementationCommit, reviewedFinWasmFieldImplementation);
	assert.equal(git(["show", "-s", "--format=%P", reviewedFinWasmFieldImplementation]).trim(), reviewedFinWasmFieldPredecessor);
	assert.deepEqual(value.updates.map(item => item.path), reviewedFinWasmFieldChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(item => item.path), reviewedFinWasmFieldIntegrationPaths);
	assert.deepEqual(value.additions.map(item => item.path), reviewedFinWasmFieldAddedPaths);
	for(const addition of value.additions) assert.equal(addition.currentSha256, sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)));
});

test("reviewed Wasm Fin-field history reverses every exact source transition", async () => {
	const value = await read();
	for(const update of value.updates)
	{
		const current = git(["show", `${reviewedFinWasmFieldImplementation}:${update.path}`]);
		const previous = git(["show", `${reviewedFinWasmFieldPredecessor}:${update.path}`]);
		assert.equal(reverseReviewedFinWasmFieldUpdate(current, update), previous);
		assert.equal(beforeReviewedFinWasmFieldSource(update.path, current, update.previousSha256), previous);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show", `${reviewedFinWasmFieldImplementation}:${update.path}`]);
		assert.equal(reverseReviewedFinWasmFieldUpdate(current, update), previous);
	}
});

test("reviewed Wasm Fin-field integration repairs every cited live source", async () => {
	// The pins are checked at this layer's own inventory milestone, not the live tree.
	const inventory = (await read()).integrationUpdates
		.find(update => update.path === "docs/type-surface.v1.json");
	const document = JSON.parse(await sourceAtFinHistoryMilestone(
		inventory.path, inventory.currentSha256));
	for(const pin of reviewedFinWasmFieldPins)
	{
		const files = document.evidence.flatMap(item => item.files).filter(item => item.path === pin.path);
		assert.equal(files.length, pin.count, pin.path);
		assert.ok(files.every(item => item.sha256 === pin.currentSha256), pin.path);
		assert.equal(sha256(git(["show", `${reviewedFinWasmFieldPredecessor}:${pin.path}`])), pin.previousSha256);
		assert.equal(sha256(git(["show", `${reviewedFinWasmFieldImplementation}:${pin.path}`])), pin.currentSha256);
	}
});

test("reviewed Wasm Fin-field history refuses altered transitions and repeat writes", async () => {
	const update = (await read()).updates[0];
	const current = git(["show", `${reviewedFinWasmFieldImplementation}:${update.path}`]);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }, { ...update, currentSha256: "0".repeat(64) }, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }])
		assert.throws(() => reverseReviewedFinWasmFieldUpdate(current, forged));
	assert.equal(beforeReviewedFinWasmFieldSource("unrelated.mjs", current), current);
	const before = await readFile(reviewedFinWasmFieldHistoryPath);
	const result = spawnSync(process.execPath, [resolve("scripts/update-reviewed-fin-wasm-field-source-history.mjs")], { encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.deepEqual(await readFile(reviewedFinWasmFieldHistoryPath), before);
	assert.ok((await readdir("docs/evidence")).includes(reviewedFinWasmFieldHistoryPath.split("/").at(-1)));
});
