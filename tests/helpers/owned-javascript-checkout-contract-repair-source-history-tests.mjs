/**
 * Authenticate the owned JavaScript checkout-contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertOwnedJavaScriptCheckoutContractRepair
	, beforeOwnedJavaScriptCheckoutContractRepairSource
	, ownedJavaScriptCheckoutContractRepairAddedPaths
	, ownedJavaScriptCheckoutContractRepairHistoryPath
	, ownedJavaScriptCheckoutContractRepairImplementation
	, ownedJavaScriptCheckoutContractRepairImplementationPaths
	, ownedJavaScriptCheckoutContractRepairIntegrationPaths
	, ownedJavaScriptCheckoutContractRepairNormalizationPaths
	, ownedJavaScriptCheckoutContractRepairPredecessor
	, reverseOwnedJavaScriptCheckoutContractRepairUpdate
} from "./owned-javascript-checkout-contract-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const record = async () => JSON.parse(await readFile(
	ownedJavaScriptCheckoutContractRepairHistoryPath, "utf8"));
const source = (revision, path) => git(["show", `${revision}:${path}`]);

test("owned JavaScript checkout repair records the complete hosted failure"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "owned-javascript-checkout-contract-repair-source-v1");
		assert.equal(history.predecessorCommit
			, ownedJavaScriptCheckoutContractRepairPredecessor);
		assert.equal(history.implementationCommit
			, ownedJavaScriptCheckoutContractRepairImplementation);
		assert.deepEqual(history.failedRun, {
			workflow: 41235164345, job: 124638176219
			, headSha: ownedJavaScriptCheckoutContractRepairPredecessor
			, test: "CI executes consuming JavaScript packages and rejects skipped checks or missing reports"
		});
		assert.deepEqual(names(["diff", "--name-only"
			, ownedJavaScriptCheckoutContractRepairPredecessor
			, ownedJavaScriptCheckoutContractRepairImplementation])
			, [...ownedJavaScriptCheckoutContractRepairImplementationPaths]
				.sort());
		assert.deepEqual(history.updates.map(update => update.path)
			, ownedJavaScriptCheckoutContractRepairImplementationPaths);
		assert.deepEqual(history.integrationUpdates.map(update => update.path)
			, ownedJavaScriptCheckoutContractRepairIntegrationPaths);
		assert.deepEqual(history.additions.map(item => item.path)
			, ownedJavaScriptCheckoutContractRepairAddedPaths);
	}
);

test("owned JavaScript checkout repair binds both exact producer shapes"
	, async () => {
		const recurring = source(
			ownedJavaScriptCheckoutContractRepairImplementation
			, ".github/workflows/consumer-matrix.yml");
		const scoped = source(
			ownedJavaScriptCheckoutContractRepairImplementation
			, ".github/workflows/owned-checked-record-npm-browser.yml");
		const result = assertOwnedJavaScriptCheckoutContractRepair(
			recurring, scoped);
		assert.equal(result.checkoutFields, 5);
		assert.equal(result.recurringContract.productionRuntimeRequired, true);
		assert.equal(result.scopedContract.jobs, 1);
		const job = recurring.match(
			/^ {2}owned-javascript-wasm:\n([^]*?)(?=^ {2}[a-z][a-z-]*:)/mu)[0];
		assert.throws(() => assertOwnedJavaScriptCheckoutContractRepair(
			recurring.replace(job, job.replace("    timeout-minutes: 90\n"
				, "    timeout-minutes: 89\n")), scoped));
		for(const field of [
			"fetch-depth: 0", "filter: blob:none"
			, "persist-credentials: false"
			, "sparse-checkout: ${{ env.LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT }}"
			, "sparse-checkout-cone-mode: false"
		]) assert.ok(scoped.includes(field), field);
	}
);

test("owned JavaScript checkout repair reverses every authenticated source"
	, async () => {
		const history = await record();
		for(const update of history.updates)
			assert.equal(reverseOwnedJavaScriptCheckoutContractRepairUpdate(
				source(ownedJavaScriptCheckoutContractRepairImplementation
					, update.path), update), source(
					ownedJavaScriptCheckoutContractRepairPredecessor
					, update.path), update.path);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = source(
				ownedJavaScriptCheckoutContractRepairImplementation
				, update.path);
			assert.equal(reverseOwnedJavaScriptCheckoutContractRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeOwnedJavaScriptCheckoutContractRepairSource(
				update.path, current, update.previousSha256), previous
			, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous
			, update.path);
		}
		for(const path of ownedJavaScriptCheckoutContractRepairNormalizationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("owned JavaScript checkout repair rejects forgeries and duplicate writers"
	, async () => {
		const history = await record();
		for(const addition of history.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = source(
			ownedJavaScriptCheckoutContractRepairImplementation, update.path);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.yml" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseOwnedJavaScriptCheckoutContractRepairUpdate(current, forged));
		const copy = spawnSync(process.execPath, [
			"scripts/update-owned-javascript-checkout-contract-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /already exists|implementation revision/u);
	}
);
