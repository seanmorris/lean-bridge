/**
 * Qualify the focused dependent-signature shallow-checkout history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDependentSignatureShallowCheckoutSource
	, dependentSignatureShallowCheckoutHistoryAdditions
	, dependentSignatureShallowCheckoutHistoryPath
	, dependentSignatureShallowCheckoutImplementation
	, dependentSignatureShallowCheckoutImplementationPaths
	, dependentSignatureShallowCheckoutIntegrationPaths
	, dependentSignatureShallowCheckoutNormalizationPaths
	, dependentSignatureShallowCheckoutPredecessor
	, reverseDependentSignatureShallowCheckoutUpdate
} from "./dependent-signature-shallow-checkout-source-history.mjs";
import { beforeFinRefinementSource }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	dependentSignatureShallowCheckoutHistoryPath, "utf8"));

test("focused shallow checkouts record their exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "dependent-signature-shallow-checkout-source-v1");
	assert.equal(value.predecessorCommit
		, dependentSignatureShallowCheckoutPredecessor);
	assert.equal(value.implementationCommit
		, dependentSignatureShallowCheckoutImplementation);
	assert.equal(git(["rev-parse"
		, `${dependentSignatureShallowCheckoutImplementation}^`]).trim()
		, dependentSignatureShallowCheckoutPredecessor);
	assert.deepEqual(value.updates.map(update => update.path)
		, [...dependentSignatureShallowCheckoutImplementationPaths]);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, [...dependentSignatureShallowCheckoutIntegrationPaths]);
	assert.equal(value.producerWorkflowCount, 11);
	assert.equal(value.fullHistoryAuditCount, 1);
	assert.deepEqual(value.currentSourcePaths, []);
	assert.equal(value.refreshedPins, 0);
});

test("focused shallow checkouts reverse every authenticated source"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = git(["show"
				, `${dependentSignatureShallowCheckoutImplementation}`
					+ `:${update.path}`]);
			const previous = git(["show"
				, `${dependentSignatureShallowCheckoutPredecessor}`
					+ `:${update.path}`]);
			assert.equal(reverseDependentSignatureShallowCheckoutUpdate(
				current, update), previous, update.path);
			assert.equal(beforeDependentSignatureShallowCheckoutSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${dependentSignatureShallowCheckoutImplementation}`
					+ `:${update.path}`]);
			assert.equal(reverseDependentSignatureShallowCheckoutUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("focused shallow checkouts authenticate their history controls"
	, async () => {
		const value = await record();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, [...dependentSignatureShallowCheckoutHistoryAdditions]);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${dependentSignatureShallowCheckoutImplementation}`
					+ `:${addition.path}`], { stdio: "ignore" }).status, 0);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256))
				, addition.sha256, addition.path);
		}
		for(const path of [
			...dependentSignatureShallowCheckoutImplementationPaths
			, ...dependentSignatureShallowCheckoutIntegrationPaths
		]) assert.ok(dependentSignatureShallowCheckoutNormalizationPaths
			.includes(path), path);
	}
);

test("focused package producers use depth one without weakening standalone runs"
	, () => {
		const parent = git(["show"
			, `${dependentSignatureShallowCheckoutImplementation}`
				+ ":.github/workflows/dependent-signature-complete.yml"]);
		assert.equal((parent.match(/^ {6}shallow_checkout: true$/gmu) ?? []).length
			, 11);
		assert.equal((parent.match(/^ {10}fetch-depth: 0$/gmu) ?? []).length, 1);
		for(const path of dependentSignatureShallowCheckoutImplementationPaths
			.filter(item => item.startsWith(
				".github/workflows/dependent-checked-record-"))){
			const source = git(["show"
				, `${dependentSignatureShallowCheckoutImplementation}:${path}`]);
			assert.match(source, /default: false\n {8}type: boolean/u, path);
			assert.equal((source.match(
				/fetch-depth: \$\{\{ inputs\.shallow_checkout && 1 \|\| 0 \}\}/gmu)
				?? []).length, 1, path);
			assert.doesNotMatch(source, /^ {10}fetch-depth: [01]$/gmu, path);
				}
	}
);

test("focused shallow checkouts reject forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${dependentSignatureShallowCheckoutImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.yml" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDependentSignatureShallowCheckoutUpdate(current, forged));
});

test("focused shallow checkout writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-dependent-signature-shallow-checkout-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /dependent-signature-shallow-checkout-source-history-20261029\.json/u);
});
