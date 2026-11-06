/**
 * Authenticate the PHP-Wasm Fin generated-C local identifier repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertPhpWasmFinLocalIdentifierRepair
	, beforePhpWasmFinLocalIdentifierSource
	, phpWasmFinLocalIdentifierBehavior
	, phpWasmFinLocalIdentifierHistoryAdditions
	, phpWasmFinLocalIdentifierHistoryPath
	, phpWasmFinLocalIdentifierImplementation
	, phpWasmFinLocalIdentifierImplementationPaths
	, phpWasmFinLocalIdentifierIntegrationPaths
	, phpWasmFinLocalIdentifierMarkers
	, phpWasmFinLocalIdentifierNormalizationPaths
	, phpWasmFinLocalIdentifierPredecessor
	, reversePhpWasmFinLocalIdentifierUpdate
} from "./php-wasm-fin-local-identifier-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource
} from "./source-at-fin-history-milestone.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	phpWasmFinLocalIdentifierHistoryPath, "utf8"));
const implementationSources = () => Object.fromEntries(
	phpWasmFinLocalIdentifierImplementationPaths.map(path => [
		path, blob(phpWasmFinLocalIdentifierImplementation, path)
	])
);

test("PHP-Wasm Fin identifier repair records its exact candidate and scope"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone, "php-wasm-fin-local-identifier-v1");
		assert.equal(value.predecessorCommit
			, phpWasmFinLocalIdentifierPredecessor);
		assert.equal(value.implementationCommit
			, phpWasmFinLocalIdentifierImplementation);
		assert.equal(git(["rev-parse"
			, `${phpWasmFinLocalIdentifierImplementation}^`]).trim()
		, phpWasmFinLocalIdentifierPredecessor);
		assert.deepEqual(value.discovery, {
			candidate: "c2eca28ce3957c14e66364767bac90656ec5074e"
			, referenceImplementation: "a2b43c970e6ac48d40b8682a22d68022563c8e79"
			, coreRun: 42248050647
			, profile: "contract"
			, test: "the PHP-Wasm side module compares caller limbs with each bound before the only conversion into Lean"
			, location: "tests/php-wasm-fin.test.mjs:157-158"
			, localReproduction: { tests: 1, pass: 0, fail: 1 }
		});
		assert.deepEqual(value.behavior
			, { ...phpWasmFinLocalIdentifierBehavior });
		assert.deepEqual(value.updates.map(update => update.path)
			, phpWasmFinLocalIdentifierImplementationPaths);
		assert.deepEqual(value.integrationUpdates.map(update => update.path)
			, phpWasmFinLocalIdentifierIntegrationPaths);
		assert.deepEqual(value.refreshed, {});
		assert.equal(value.changedSupportCells, 0);
		assert.equal(value.runtimeSemanticChanges, 0);
	}
);

test("PHP-Wasm Fin identifier repair binds both current locals and the ordering"
	, () => {
		const sources = implementationSources();
		assert.deepEqual(assertPhpWasmFinLocalIdentifierRepair(sources)
			, { ...phpWasmFinLocalIdentifierBehavior });
		const path = "tests/php-wasm-fin.test.mjs";
		const [checked, budget] = phpWasmFinLocalIdentifierMarkers.current;
		const [oldChecked, oldBudget] = phpWasmFinLocalIdentifierMarkers.previous;
		for(const [label, mutate] of [
			["stale checked local restored", source =>
				source.replace(checked, oldChecked)]
			, ["stale budget local restored", source =>
				source.replace(budget, oldBudget)]
			, ["ordering check weakened", source => source.replace(
				phpWasmFinLocalIdentifierMarkers.ordering, "< inner, nest);")]
			, ["checked local duplicated", source => `${source}\n// ${checked}\n`]
		]) {
			const changed = { ...sources, [path]: mutate(sources[path]) };
			assert.notEqual(changed[path], sources[path], label);
			assert.throws(() => assertPhpWasmFinLocalIdentifierRepair(changed)
				, { name: "AssertionError" }, label);
		}
		assert.equal(phpWasmFinLocalIdentifierMarkers.previous.every(marker =>
			blob(phpWasmFinLocalIdentifierPredecessor, path).includes(marker))
		, true);
	}
);

test("PHP-Wasm Fin identifier repair reverses implementation and integration"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = blob(phpWasmFinLocalIdentifierImplementation
				, update.path);
			const previous = blob(phpWasmFinLocalIdentifierPredecessor
				, update.path);
			assert.equal(reversePhpWasmFinLocalIdentifierUpdate(current, update)
				, previous, update.path);
			assert.equal(beforePhpWasmFinLocalIdentifierSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				phpWasmFinLocalIdentifierHistoryPath, update.path
				, update.currentSha256);
			const previous = blob(phpWasmFinLocalIdentifierImplementation
				, update.path);
			assert.equal(reversePhpWasmFinLocalIdentifierUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of phpWasmFinLocalIdentifierNormalizationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("PHP-Wasm Fin identifier repair leaves every live pin and the model unchanged"
	, async () => {
		const value = await record();
		const inventories = [phpWasmFinLocalIdentifierPredecessor
			, phpWasmFinLocalIdentifierImplementation].map(commit =>
			blob(commit, inventoryPath));
		assert.equal(sha256(inventories[0]), sha256(inventories[1]));
		assert.deepEqual(value.inventorySha256, {
			before: sha256(inventories[0]), after: sha256(inventories[1])
		});
		for(const path of phpWasmFinLocalIdentifierImplementationPaths)
			for(const commit of [phpWasmFinLocalIdentifierPredecessor
				, phpWasmFinLocalIdentifierImplementation])
				assert.equal(inventories[1].includes(sha256(blob(commit, path)))
					, false, `${commit}:${path}`);
		assert.deepEqual(value.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
	}
);

test("PHP-Wasm Fin identifier repair authenticates additions and rejects forgeries"
	, async () => {
		const value = await record();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, phpWasmFinLocalIdentifierHistoryAdditions);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${phpWasmFinLocalIdentifierImplementation}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		}
		const update = value.updates[0];
		const current = blob(phpWasmFinLocalIdentifierImplementation
			, update.path);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() => reversePhpWasmFinLocalIdentifierUpdate(
			current, forged));
		assert.equal(beforePhpWasmFinLocalIdentifierSource(
			"unknown.mjs", current), current);
		assert.equal(beforePhpWasmFinLocalIdentifierSource(update.path
			, `${current}unknown\n`), `${current}unknown\n`);
		const copy = spawnSync(process.execPath, [
			"scripts/update-php-wasm-fin-local-identifier-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /History already exists|Expected values to be strictly equal/u);
	}
);
