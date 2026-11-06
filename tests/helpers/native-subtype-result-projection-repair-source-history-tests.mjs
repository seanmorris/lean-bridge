/**
 * Authenticate the native Subtype result-projection fixture repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertNativeSubtypeResultProjectionRepair
	, beforeNativeSubtypeResultProjectionRepairSource
	, nativeSubtypeResultProjectionRepairBehavior
	, nativeSubtypeResultProjectionRepairHistoryAdditions
	, nativeSubtypeResultProjectionRepairHistoryPath
	, nativeSubtypeResultProjectionRepairImplementation
	, nativeSubtypeResultProjectionRepairImplementationPaths
	, nativeSubtypeResultProjectionRepairIntegrationPaths
	, nativeSubtypeResultProjectionRepairNormalizationPaths
	, nativeSubtypeResultProjectionRepairPredecessor
	, reverseNativeSubtypeResultProjectionRepairUpdate
} from "./native-subtype-result-projection-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	nativeSubtypeResultProjectionRepairHistoryPath, "utf8"));
const implementationSources = () => Object.fromEntries(
	nativeSubtypeResultProjectionRepairImplementationPaths.map(path => [
		path, blob(nativeSubtypeResultProjectionRepairImplementation, path)
	])
);

test("native Subtype result repair records the exact hosted rejection", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "native-subtype-result-projection-repair-v1");
	assert.equal(value.predecessorCommit
		, nativeSubtypeResultProjectionRepairPredecessor);
	assert.equal(value.implementationCommit
		, nativeSubtypeResultProjectionRepairImplementation);
	assert.equal(git(["rev-parse"
		, `${nativeSubtypeResultProjectionRepairImplementation}^`]).trim()
		, nativeSubtypeResultProjectionRepairPredecessor);
	assert.deepEqual(value.discovery, {
		run: 42248057427, job: 128006559588
		, candidate: "c2eca28ce3957c14e66364767bac90656ec5074e"
		, event: "workflow_dispatch"
		, profile: "Perl / Perl XS (5.36.3-threaded)"
		, failingTest: "relocated source-free native packages run author-checked constructors at every refined site"
	});
	assert.deepEqual(value.updates.map(update => update.path)
		, nativeSubtypeResultProjectionRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, nativeSubtypeResultProjectionRepairIntegrationPaths);
});

test("native Subtype result repair separates live projections from history", () => {
	const sources = implementationSources();
	assert.deepEqual(assertNativeSubtypeResultProjectionRepair(sources), {
		...nativeSubtypeResultProjectionRepairBehavior
		, livePinRefreshes: {
			...nativeSubtypeResultProjectionRepairBehavior.livePinRefreshes
		}
	});
	for(const [path, before, after] of [
		["tests/helpers/native-subtype-install.mjs"
			, "result: projected", "result: site(\"Subtypes.checkedWord\")"]
		, ["tests/helpers/php-wasm-subtype-fixture.mjs"
			, "historicalContracts[name].result = site(constructor);", ""]
		, ["tests/native-subtype.test.mjs"
			, "result projects the Subtype base value"
			, "result checked by a constructor"]
	]) {
		const changed = { ...sources
			, [path]: sources[path].replace(before, after) };
		assert.notEqual(changed[path], sources[path], path);
		assert.throws(() => assertNativeSubtypeResultProjectionRepair(changed)
			, { name: "AssertionError" }, path);
	}
});

test("native Subtype result repair reverses both authenticated layers"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = blob(nativeSubtypeResultProjectionRepairImplementation
				, update.path);
			const previous = blob(nativeSubtypeResultProjectionRepairPredecessor
				, update.path);
			assert.equal(reverseNativeSubtypeResultProjectionRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeNativeSubtypeResultProjectionRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = await sourceAtFinHistoryMilestone(
				update.path, update.previousSha256);
			assert.equal(reverseNativeSubtypeResultProjectionRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of nativeSubtypeResultProjectionRepairNormalizationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("native Subtype result repair refreshes exactly thirty-eight live pins"
	, async () => {
		const value = await record();
		assert.deepEqual(value.behavior, {
			...nativeSubtypeResultProjectionRepairBehavior
			, livePinRefreshes: {
				...nativeSubtypeResultProjectionRepairBehavior.livePinRefreshes
			}
		});
		assert.equal(Object.values(value.refreshed)
			.reduce((total, entry) => total + entry.count, 0), 38);
		for(const [path, count] of Object.entries(
			nativeSubtypeResultProjectionRepairBehavior.livePinRefreshes)) {
			const entry = value.refreshed[path];
			assert.equal(entry.count, count, path);
			assert.equal(entry.previous, sha256(blob(
				nativeSubtypeResultProjectionRepairPredecessor, path)), path);
			assert.equal(entry.current, sha256(blob(
				nativeSubtypeResultProjectionRepairImplementation, path)), path);
			}
		assert.deepEqual(value.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
		assert.equal(value.changedSupportCells, 0);
		assert.equal(value.runtimeSemanticChanges, 0);
	}
);

test("native Subtype result repair authenticates additions and forgeries"
	, async () => {
		const value = await record();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, nativeSubtypeResultProjectionRepairHistoryAdditions);
		for(const addition of value.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = value.updates[0];
		const current = blob(nativeSubtypeResultProjectionRepairImplementation
			, update.path);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() => reverseNativeSubtypeResultProjectionRepairUpdate(
			current, forged));
		assert.equal(beforeNativeSubtypeResultProjectionRepairSource(
			"unknown.mjs", current), current);
		const copy = spawnSync(process.execPath, [
			"scripts/update-native-subtype-result-projection-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /History already exists|Expected values to be strictly equal/u);
	}
);
