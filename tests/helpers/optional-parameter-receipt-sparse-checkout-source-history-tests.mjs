/**
 * Qualify the optional-parameter receipt sparse-checkout history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalParameterReceiptSparseCheckoutSource
	, optionalParameterReceiptSparseCheckoutHistoryAdditions
	, optionalParameterReceiptSparseCheckoutHistoryPath
	, optionalParameterReceiptSparseCheckoutImplementation
	, optionalParameterReceiptSparseCheckoutImplementationPaths
	, optionalParameterReceiptSparseCheckoutIntegrationPaths
	, optionalParameterReceiptSparseCheckoutNormalizationPaths
	, optionalParameterReceiptSparseCheckoutPredecessor
	, reverseOptionalParameterReceiptSparseCheckoutUpdate
} from "./optional-parameter-receipt-sparse-checkout-source-history.mjs";
import { beforeFinRefinementSource }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	optionalParameterReceiptSparseCheckoutHistoryPath, "utf8"));

test("optional receipt sparse checkout records its exact implementation"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "optional-parameter-receipt-sparse-checkout-source-v1");
		assert.equal(value.predecessorCommit
			, optionalParameterReceiptSparseCheckoutPredecessor);
		assert.equal(value.implementationCommit
			, optionalParameterReceiptSparseCheckoutImplementation);
		assert.equal(git(["rev-parse"
			, `${optionalParameterReceiptSparseCheckoutImplementation}^`]).trim()
			, optionalParameterReceiptSparseCheckoutPredecessor);
		assert.deepEqual(value.updates.map(update => update.path)
			, [...optionalParameterReceiptSparseCheckoutImplementationPaths]);
		assert.deepEqual(value.integrationUpdates.map(update => update.path)
			, [...optionalParameterReceiptSparseCheckoutIntegrationPaths]);
		assert.equal(value.excludedTree, "docs/evidence");
		assert.deepEqual(value.currentSourcePaths, []);
		assert.equal(value.refreshedPins, 0);
	}
);

test("optional receipt sparse checkout reverses every authenticated source"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = git(["show"
				, `${optionalParameterReceiptSparseCheckoutImplementation}`
					+ `:${update.path}`]);
			const previous = git(["show"
				, `${optionalParameterReceiptSparseCheckoutPredecessor}`
					+ `:${update.path}`]);
			assert.equal(reverseOptionalParameterReceiptSparseCheckoutUpdate(
				current, update), previous, update.path);
			assert.equal(beforeOptionalParameterReceiptSparseCheckoutSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${optionalParameterReceiptSparseCheckoutImplementation}`
					+ `:${update.path}`]);
			assert.equal(reverseOptionalParameterReceiptSparseCheckoutUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("optional receipt sparse checkout authenticates its history controls"
	, async () => {
		const value = await record();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, [...optionalParameterReceiptSparseCheckoutHistoryAdditions]);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${optionalParameterReceiptSparseCheckoutImplementation}`
					+ `:${addition.path}`], { stdio: "ignore" }).status, 0);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256))
				, addition.sha256, addition.path);
		}
		for(const path of [
			...optionalParameterReceiptSparseCheckoutImplementationPaths
			, ...optionalParameterReceiptSparseCheckoutIntegrationPaths
		]) assert.ok(optionalParameterReceiptSparseCheckoutNormalizationPaths
			.includes(path), path);
	}
);

test("optional receipt excludes only immutable evidence", () => {
	const workflow = git(["show"
		, `${optionalParameterReceiptSparseCheckoutImplementation}`
			+ ":.github/workflows/optional-parameter-complete.yml"]);
	assert.match(workflow
		, /fetch-depth: 1\n {10}persist-credentials: false\n {10}sparse-checkout: \|\n {12}\/\*\n {12}!\/docs\/evidence\/\n {10}sparse-checkout-cone-mode: false/u);
	assert.equal((workflow.match(/!\/docs\/evidence\//gmu) ?? []).length, 1);
	assert.match(workflow, /pattern: optional-parameter-\*-\$\{\{ github\.sha \}\}/u);
	assert.match(workflow, /steps\.reconciliation\.outcome != 'success'/u);
});

test("optional receipt sparse checkout rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${optionalParameterReceiptSparseCheckoutImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.yml" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseOptionalParameterReceiptSparseCheckoutUpdate(current, forged));
});

test("optional receipt sparse checkout writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-optional-parameter-receipt-sparse-checkout-source-history.mjs"
	], { cwd: new URL("../../", import.meta.url), encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /optional-parameter-receipt-sparse-checkout-source-history-20261029\.json/u);
});
