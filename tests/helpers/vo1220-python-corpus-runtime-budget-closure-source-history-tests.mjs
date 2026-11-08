/**
 * Verify the Python runtime-budget contract closure and source-history seal.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	assertVo1220PythonCorpusRuntimeBudgetClosure
	, beforeVo1220PythonCorpusRuntimeBudgetClosureSource
	, reverseVo1220PythonCorpusRuntimeBudgetClosureUpdate
	, vo1220PythonCorpusRuntimeBudgetClosureBehavior
	, vo1220PythonCorpusRuntimeBudgetClosureHistoryAdditions
	, vo1220PythonCorpusRuntimeBudgetClosureHistoryPath
	, vo1220PythonCorpusRuntimeBudgetClosureImplementation
	, vo1220PythonCorpusRuntimeBudgetClosureImplementationPaths
	, vo1220PythonCorpusRuntimeBudgetClosureIntegrationPaths
	, vo1220PythonCorpusRuntimeBudgetClosureNormalizationPaths
	, vo1220PythonCorpusRuntimeBudgetClosurePredecessor
} from "./vo1220-python-corpus-runtime-budget-closure-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const read = async () => JSON.parse(await readFile(
	vo1220PythonCorpusRuntimeBudgetClosureHistoryPath, "utf8"
));

test("Python budget contract closure authenticates every transition", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "vo1220-python-corpus-runtime-budget-closure-source-v1");
	assert.equal(record.predecessorCommit
		, vo1220PythonCorpusRuntimeBudgetClosurePredecessor);
	assert.equal(record.implementationCommit
		, vo1220PythonCorpusRuntimeBudgetClosureImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, vo1220PythonCorpusRuntimeBudgetClosureImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, vo1220PythonCorpusRuntimeBudgetClosureIntegrationPaths);
	assert.deepEqual(record.historyAdditions.map(addition => addition.path)
		, vo1220PythonCorpusRuntimeBudgetClosureHistoryAdditions);
	for(const addition of record.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	for(const update of record.updates)
	{
		const current = blob(vo1220PythonCorpusRuntimeBudgetClosureImplementation
			, update.path);
		const previous = blob(vo1220PythonCorpusRuntimeBudgetClosurePredecessor
			, update.path);
		assert.equal(reverseVo1220PythonCorpusRuntimeBudgetClosureUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = blob(vo1220PythonCorpusRuntimeBudgetClosureImplementation
			, update.path);
		assert.equal(reverseVo1220PythonCorpusRuntimeBudgetClosureUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("Python budget contract closure changes no support or runtime semantics"
	, async () => {
		const record = await read();
		assert.deepEqual(record.behavior
			, vo1220PythonCorpusRuntimeBudgetClosureBehavior);
		assert.equal(record.changedSupportCells, 0);
		assert.equal(record.runtimeSemanticChanges, 0);
		const sources = Object.fromEntries(
			vo1220PythonCorpusRuntimeBudgetClosureImplementationPaths.map(path => [
				path, blob(vo1220PythonCorpusRuntimeBudgetClosureImplementation, path)
			])
		);
		assert.deepEqual(assertVo1220PythonCorpusRuntimeBudgetClosure(sources)
			, vo1220PythonCorpusRuntimeBudgetClosureBehavior);
		const exactPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
		const previousExact = blob(vo1220PythonCorpusRuntimeBudgetClosurePredecessor
			, exactPath);
		const currentExact = blob(vo1220PythonCorpusRuntimeBudgetClosureImplementation
			, exactPath);
		assert.equal(currentExact, previousExact);
		assert.equal(record.exactModel.sha256, sha256(currentExact));
		const before = JSON.parse(blob(
			vo1220PythonCorpusRuntimeBudgetClosureImplementation
			, "docs/type-surface.v1.json"));
		const after = JSON.parse(await sourceAtFinHistoryMilestone(
			"docs/type-surface.v1.json", record.inventorySha256.after));
		assert.deepEqual(record.currentSourcePins, [{
			path: "tests/documentation.test.mjs", count: 25
			, previous: record.currentSourcePins[0].previous
			, current: record.currentSourcePins[0].current
		}]);
		const pin = record.currentSourcePins[0];
		for(const evidence of after.evidence) for(const file of evidence.files)
			if(file.path === pin.path) file.sha256 = pin.previous;
		assert.deepEqual(after, before
			, "Only documentation current-source pins may change");
	}
);

test("Python budget contract closure rejects unknown and forged transitions"
	, async () => {
		const update = (await read()).updates[0];
		const current = blob(vo1220PythonCorpusRuntimeBudgetClosureImplementation
			, update.path);
		assert.equal(beforeVo1220PythonCorpusRuntimeBudgetClosureSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeVo1220PythonCorpusRuntimeBudgetClosureSource(
			update.path, current + "unknown"), current + "unknown");
		for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
			assert.throws(() =>
				reverseVo1220PythonCorpusRuntimeBudgetClosureUpdate(current, forged));
		assert.ok(vo1220PythonCorpusRuntimeBudgetClosureNormalizationPaths
			.includes(update.path));
	}
);

test("Python budget contract closure writer refuses another checkout", async t => {
	const root = await mkdtemp(`${tmpdir()}/lean-python-budget-closure-guard-`);
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-python-corpus-runtime-budget-closure-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Expected values to be strictly equal/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
