/**
 * Authenticate the Alpha npm package module-closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	alphaNpmModuleClosureHistoryAdditions
	, alphaNpmModuleClosureHistoryPath
	, alphaNpmModuleClosureImplementation
	, alphaNpmModuleClosureImplementationPaths
	, alphaNpmModuleClosureIntegrationPaths
	, alphaNpmModuleClosurePinPaths
	, alphaNpmModuleClosurePredecessor
	, alphaNpmModuleClosureSourceCommit
	, beforeAlphaNpmModuleClosureSource
	, reverseAlphaNpmModuleClosureUpdate
} from "./alpha-npm-module-closure-source-history.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const record = async () => JSON.parse(await readFile(
	alphaNpmModuleClosureHistoryPath, "utf8"));

test("Alpha npm closure records its exact two-commit source range", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "alpha-npm-module-closure-source-v1");
	assert.equal(history.predecessorCommit, alphaNpmModuleClosurePredecessor);
	assert.equal(history.implementationCommit, alphaNpmModuleClosureImplementation);
	assert.equal(history.sourceCommit, alphaNpmModuleClosureSourceCommit);
	assert.equal(git(["rev-parse", alphaNpmModuleClosureSourceCommit + "^"]).trim()
		, alphaNpmModuleClosureImplementation);
	assert.equal(git(["rev-parse", alphaNpmModuleClosureImplementation + "^"]).trim()
		, alphaNpmModuleClosurePredecessor);
	assert.deepEqual(names(["diff", "--name-only"
		, alphaNpmModuleClosurePredecessor
		, alphaNpmModuleClosureImplementation
		, "--"])
		, [...alphaNpmModuleClosureImplementationPaths].sort());
	assert.deepEqual(names(["diff", "--name-only"
		, alphaNpmModuleClosureImplementation
		, alphaNpmModuleClosureSourceCommit
		, "--"])
		, [...alphaNpmModuleClosurePinPaths].sort());
});

test("Alpha npm closure records the hosted product-boundary failure", async () => {
	const history = await record();
	assert.deepEqual(history.failedRun
		, { workflow: 41204400085, job: 124548376979 });
	assert.deepEqual(history.failure, {
		consumer: "docker-engine-node"
		, completedAt: "2026-10-31T14:05:43Z"
		, code: "ERR_MODULE_NOT_FOUND"
		, importer: "internal/bridge/src/binding-ir/contract.mjs"
		, missing: "internal/bridge/src/binding-ir/default-value.mjs"
		, diskClosurePassed: true, executedProductBoundary: true
	});
});

test("Alpha npm closure reverses every source and integration transition"
	, async () => {
		const history = await record();
		assert.deepEqual(history.updates.map(item => item.path)
			, [...alphaNpmModuleClosureImplementationPaths
				, ...alphaNpmModuleClosurePinPaths]);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, alphaNpmModuleClosureIntegrationPaths);
		for(const update of history.updates)
		{
			const commit = alphaNpmModuleClosurePinPaths.includes(update.path)
				? alphaNpmModuleClosureSourceCommit
				: alphaNpmModuleClosureImplementation;
			assert.equal(await authenticateSourceHistoryReverse(
				gitSourceBytes(commit, update.path), update), true, update.path);
		}
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, alphaNpmModuleClosureSourceCommit + ":" + update.path]);
			assert.equal(reverseAlphaNpmModuleClosureUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeAlphaNpmModuleClosureSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("Alpha npm closure seals the complete assembly guard and mutation control"
	, async () => {
		const history = await record();
		assert.deepEqual(history.bundleAdditions, [
			"runtime/javascript/src/binding-ir/default-value.mjs"
			, "validators/src/binding-ir/default-value.mjs"
		]);
		assert.equal(history.packageAddition
			, "internal/bridge/src/binding-ir/default-value.mjs");
		assert.deepEqual(history.closure, {
			assemblyGuard: "validateNpmPackageModuleClosure"
			, covers: "every relative import in every assembled .mjs module"
			, omittedDependencyControl: true
		});
		const packageSource = git(["show"
			, alphaNpmModuleClosureImplementation
				+ ":src/release/npm-package.mjs"]);
		assert.match(packageSource, /validateNpmPackageModuleClosure/u);
		assert.match(packageSource
			, /internal\/bridge\/src\/binding-ir\/default-value\.mjs/u);
		const packageTest = git(["show"
			, alphaNpmModuleClosureImplementation + ":tests/npm-package.test.mjs"]);
		assert.match(packageTest, /await rm\(dependency\)/u);
		assert.match(packageTest, /assert\.rejects/u);
	}
);

test("Alpha npm closure refreshes exactly one live source citation", async () => {
	const history = await record();
	assert.equal(history.refreshedCitationCount, 1);
	assert.deepEqual(history.currentSourcePins.map(item => ({
		path: item.path, count: item.count
	})), [{ path: "src/release/npm-package.mjs", count: 1 }]);
	let restored = git(["show"
		, alphaNpmModuleClosureSourceCommit + ":docs/type-surface.v1.json"]);
	for(const pin of history.currentSourcePins)
	{
		assert.equal(restored.split(pin.current).length - 1, pin.count);
		restored = restored.replaceAll(pin.current, pin.previous);
	}
	assert.equal(restored, git(["show"
		, alphaNpmModuleClosureImplementation + ":docs/type-surface.v1.json"]));
});

test("Alpha npm closure authenticates additions and rejects forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, alphaNpmModuleClosureHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, alphaNpmModuleClosureImplementation + ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseAlphaNpmModuleClosureUpdate(current, forged));
	}
);

test("Alpha npm closure history writer refuses another record", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-alpha-npm-module-closure-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /alpha-npm-module-closure-source-history-20261031\.json/u);
});
