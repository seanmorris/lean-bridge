/**
 * Authenticate the complete deferred-workflow history isolation repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertDeferredWorkflowHistoryIsolation
	, beforeDeferredWorkflowHistoryIsolationSource
	, deferredWorkflowHistoryIsolationBehavior
	, deferredWorkflowHistoryIsolationHistoryAdditions
	, deferredWorkflowHistoryIsolationHistoryPath
	, deferredWorkflowHistoryIsolationImplementation
	, deferredWorkflowHistoryIsolationImplementationPaths
	, deferredWorkflowHistoryIsolationIntegrationPaths
	, deferredWorkflowHistoryIsolationLoaders
	, deferredWorkflowHistoryIsolationNormalizationPaths
	, deferredWorkflowHistoryIsolationPredecessor
	, reverseDeferredWorkflowHistoryIsolationUpdate
} from "./deferred-workflow-history-isolation-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource
} from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	deferredWorkflowHistoryIsolationHistoryPath, "utf8"));
const implementationSources = () => Object.fromEntries(
	deferredWorkflowHistoryIsolationImplementationPaths.map(path => [
		path, blob(deferredWorkflowHistoryIsolationImplementation, path)
	])
);

test("deferred-workflow isolation records the exact failed candidate and scope"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "deferred-workflow-history-isolation-v1");
		assert.equal(value.predecessorCommit
			, deferredWorkflowHistoryIsolationPredecessor);
		assert.equal(value.implementationCommit
			, deferredWorkflowHistoryIsolationImplementation);
		assert.equal(git(["rev-parse"
			, `${deferredWorkflowHistoryIsolationImplementation}^`]).trim()
		, deferredWorkflowHistoryIsolationPredecessor);
		assert.deepEqual(value.discovery, {
			run: 42214825457
			, jobs: [
				{ job: 127890569531, lane: "Perl / Perl XS (5.36.3-threaded)" }
				, { job: 127890569578, lane: "Perl / Perl XS (5.38.2-threaded)" }
			]
			, failures: [
				"Fin product arrays changes current source pins without inventing installed evidence"
				, "C adapters compare every element's component and active error branch on caller limbs before Lean runs"
			]
		});
		assert.deepEqual(value.behavior, {
			...deferredWorkflowHistoryIsolationBehavior
			, livePinRefreshes: {
				...deferredWorkflowHistoryIsolationBehavior.livePinRefreshes
			}
		});
		assert.deepEqual(value.updates.map(update => update.path)
			, deferredWorkflowHistoryIsolationImplementationPaths);
		assert.deepEqual(value.integrationUpdates.map(update => update.path)
			, deferredWorkflowHistoryIsolationIntegrationPaths);
		assert.equal(value.changedSupportCells, 0);
		assert.equal(value.runtimeSemanticChanges, 0);
	}
);

test("deferred-workflow isolation binds all moved suites and complete lanes", () => {
	const sources = implementationSources();
	assert.deepEqual(assertDeferredWorkflowHistoryIsolation(sources), {
		...deferredWorkflowHistoryIsolationBehavior
		, livePinRefreshes: {
			...deferredWorkflowHistoryIsolationBehavior.livePinRefreshes
		}
	});
	const [parent, modules] = Object.entries(
		deferredWorkflowHistoryIsolationLoaders)[0];
	for(const [label, mutate] of [
		["loader dropped", changed => {
			changed[parent] = changed[parent].replace(
				`() => import("${modules[0]}")`, "() => Promise.resolve()");
		}]
		, ["loader made eager", changed => {
			changed[parent] = `import "${modules[0]}";\n${changed[parent]}`;
		}]
		, ["workflow omitted", changed => {
			changed["tests/retained-contract-tests.test.mjs"] = changed[
				"tests/retained-contract-tests.test.mjs"].replace(
				'\t, [".github/workflows/perl-consumer.yml", "perl"]\n', "");
		}]
		, ["stale C expectation restored", changed => {
			changed["tests/native-fin-product-arrays.test.mjs"] = changed[
				"tests/native-fin-product-arrays.test.mjs"].replace(
				"lean_object *_lb_checked = ", "lean_object *checked = ");
		}]
	]) {
		const changed = structuredClone(sources);
		mutate(changed);
		assert.throws(() => assertDeferredWorkflowHistoryIsolation(changed)
			, { name: "AssertionError" }, label);
	}
});

test("deferred-workflow isolation reverses implementation and integration"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = blob(deferredWorkflowHistoryIsolationImplementation
				, update.path);
			const previous = blob(deferredWorkflowHistoryIsolationPredecessor
				, update.path);
			assert.equal(reverseDeferredWorkflowHistoryIsolationUpdate(
				current, update), previous, update.path);
			assert.equal(beforeDeferredWorkflowHistoryIsolationSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				deferredWorkflowHistoryIsolationHistoryPath, update.path
				, update.currentSha256);
			const previous = blob(deferredWorkflowHistoryIsolationImplementation
				, update.path);
			assert.equal(reverseDeferredWorkflowHistoryIsolationUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of deferredWorkflowHistoryIsolationNormalizationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("deferred-workflow isolation refreshes exactly nineteen live pins"
	, async () => {
		const value = await record();
		const inventoryUpdate = value.integrationUpdates.find(update =>
			update.path === "docs/type-surface.v1.json");
		assert.ok(inventoryUpdate);
		const current = await sourceAtFinHistoryRecordSource(
			deferredWorkflowHistoryIsolationHistoryPath, inventoryUpdate.path
			, inventoryUpdate.currentSha256);
		let restored = current;
		for(const [path, entry] of Object.entries(value.refreshed))
		{
			assert.equal(entry.count
				, deferredWorkflowHistoryIsolationBehavior.livePinRefreshes[path]
				, path);
			assert.equal(current.split(entry.current).length - 1
				, entry.count, path);
			assert.equal(entry.previous, sha256(blob(
				deferredWorkflowHistoryIsolationPredecessor, path)), path);
			assert.equal(entry.current, sha256(blob(
				deferredWorkflowHistoryIsolationImplementation, path)), path);
			restored = restored.replaceAll(entry.current, entry.previous);
		}
		assert.equal(restored, blob(
			deferredWorkflowHistoryIsolationImplementation
			, "docs/type-surface.v1.json"));
		assert.deepEqual(value.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
	}
);

test("deferred-workflow isolation authenticates additions and rejects forgeries"
	, async () => {
		const value = await record();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, deferredWorkflowHistoryIsolationHistoryAdditions);
		for(const addition of value.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = value.updates[0];
		const current = blob(deferredWorkflowHistoryIsolationImplementation
			, update.path);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() => reverseDeferredWorkflowHistoryIsolationUpdate(
			current, forged));
		assert.equal(beforeDeferredWorkflowHistoryIsolationSource(
			"unknown.mjs", current), current);
		const copy = spawnSync(process.execPath, [
			"scripts/update-deferred-workflow-history-isolation-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /History already exists|Expected values to be strictly equal/u);
	}
);
