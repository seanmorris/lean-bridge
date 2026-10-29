/**
 * Qualify the npm runtime module-graph closure history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeNpmRuntimeModuleGraphClosureSource
	, npmRuntimeModuleGraphClosureCommits
	, npmRuntimeModuleGraphClosureHistoryAdditions
	, npmRuntimeModuleGraphClosureHistoryPath
	, npmRuntimeModuleGraphClosureImplementation
	, npmRuntimeModuleGraphClosureImplementationAdditions
	, npmRuntimeModuleGraphClosureImplementationPaths
	, npmRuntimeModuleGraphClosureIntegrationPaths
	, npmRuntimeModuleGraphClosureNormalizationPaths
	, npmRuntimeModuleGraphClosurePackagePath
	, npmRuntimeModuleGraphClosurePredecessor
	, npmRuntimeModuleGraphClosureSourceCommit
	, reverseNpmRuntimeModuleGraphClosureUpdate
} from "./npm-runtime-module-graph-closure-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean);
const record = async () => JSON.parse(await readFile(
	npmRuntimeModuleGraphClosureHistoryPath, "utf8"));

test("npm runtime module closure records its exact two-commit implementation"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "npm-runtime-module-graph-closure-source-v1");
		assert.equal(value.predecessorCommit
			, npmRuntimeModuleGraphClosurePredecessor);
		assert.equal(value.sourceCommit, npmRuntimeModuleGraphClosureSourceCommit);
		assert.equal(value.implementationCommit
			, npmRuntimeModuleGraphClosureImplementation);
		assert.deepEqual(names(["rev-list", "--reverse"
			, `${npmRuntimeModuleGraphClosurePredecessor}`
				+ `..${npmRuntimeModuleGraphClosureImplementation}`])
			, [...npmRuntimeModuleGraphClosureCommits]);
		assert.deepEqual(value.updates.map(update => update.path)
			, [...npmRuntimeModuleGraphClosureImplementationPaths]);
		assert.deepEqual(value.integrationUpdates.map(update => update.path)
			, [...npmRuntimeModuleGraphClosureIntegrationPaths]);
	}
);

test("npm runtime module closure reverses every authenticated source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		if(update.path === "docs/type-surface.v1.json")
		{
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				npmRuntimeModuleGraphClosureImplementation, update.path), update), true);
			continue;
		}
		const current = git(["show"
			, `${npmRuntimeModuleGraphClosureImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${npmRuntimeModuleGraphClosurePredecessor}:${update.path}`]);
		assert.equal(reverseNpmRuntimeModuleGraphClosureUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeNpmRuntimeModuleGraphClosureSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${npmRuntimeModuleGraphClosureImplementation}:${update.path}`]);
		assert.equal(reverseNpmRuntimeModuleGraphClosureUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("npm runtime module closure authenticates additions and registrations"
	, async () => {
		const value = await record();
		assert.deepEqual(value.implementationAdditions.map(item => item.path)
			, [...npmRuntimeModuleGraphClosureImplementationAdditions]);
		for(const addition of value.implementationAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${npmRuntimeModuleGraphClosurePredecessor}:${addition.path}`]
				, { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(git(["show"
				, `${npmRuntimeModuleGraphClosureImplementation}:${addition.path}`]))
				, addition.sha256, addition.path);
		}
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, [...npmRuntimeModuleGraphClosureHistoryAdditions]);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${npmRuntimeModuleGraphClosureImplementation}:${addition.path}`]
				, { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256))
				, addition.sha256, addition.path);
		}
		for(const path of [
			...npmRuntimeModuleGraphClosureImplementationPaths
			, ...npmRuntimeModuleGraphClosureIntegrationPaths
		]) assert.ok(npmRuntimeModuleGraphClosureNormalizationPaths
			.includes(path), path);
	}
);

test("npm runtime module closure refreshes exactly sixteen live citations"
	, async () => {
		const value = await record();
		assert.deepEqual(value.currentSourcePaths
			, [npmRuntimeModuleGraphClosurePackagePath]);
		assert.equal(value.refreshedPins, 16);
		const update = value.updates.find(item =>
			item.path === "docs/type-surface.v1.json");
		assert.equal(update.edits.length, 16);
		const previous = sha256(git(["show"
			, `${npmRuntimeModuleGraphClosurePredecessor}`
				+ `:${npmRuntimeModuleGraphClosurePackagePath}`]));
		const current = sha256(git(["show"
			, `${npmRuntimeModuleGraphClosureImplementation}`
				+ `:${npmRuntimeModuleGraphClosurePackagePath}`]));
		for(const edit of update.edits)
		{
			assert.equal(edit.previous.trim(), `"sha256": "${previous}"`);
			assert.equal(edit.current.trim(), `"sha256": "${current}"`);
		}
	}
);

test("npm runtime module closure ships every relative runtime dependency", () => {
	const source = git(["show"
		, `${npmRuntimeModuleGraphClosureImplementation}`
			+ `:${npmRuntimeModuleGraphClosurePackagePath}`]);
	assert.match(source
		, /\["canonical", "contract", "default-value", "sha256"\]/u);
	const packageTest = git(["show"
		, `${npmRuntimeModuleGraphClosureImplementation}`
			+ ":tests/component-npm-package.test.mjs"]);
	assert.match(packageTest
		, /internal\/binding-ir\/default-value\.mjs/u);
	const identityTest = git(["show"
		, `${npmRuntimeModuleGraphClosureImplementation}`
			+ ":tests/component-runtime-package-identity.test.mjs"]);
	assert.match(identityTest, /assertClosedRuntimeModules\(ordinary\)/u);
	assert.match(identityTest, /imports missing/u);
});

test("npm runtime module closure rejects forged transitions", async () => {
	const update = (await record()).updates.find(item =>
		item.path === npmRuntimeModuleGraphClosurePackagePath);
	const current = git(["show"
		, `${npmRuntimeModuleGraphClosureImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseNpmRuntimeModuleGraphClosureUpdate(
		current, forged));
});
