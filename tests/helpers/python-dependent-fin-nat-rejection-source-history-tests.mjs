/**
 * Authenticate the Python dependent-Fin Nat-rejection repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { typeSurfaceEvidenceFiles }
	from "../../src/adoption/type-surface-evidence-receipt.mjs";
import {
	beforePythonDependentFinNatRejectionSource
	, pythonDependentFinNatRejectionHistoryAdditions
	, pythonDependentFinNatRejectionHistoryPath
	, pythonDependentFinNatRejectionImplementation
	, pythonDependentFinNatRejectionImplementationPaths
	, pythonDependentFinNatRejectionIntegrationPaths
	, pythonDependentFinNatRejectionPredecessor
	, reversePythonDependentFinNatRejectionUpdate
} from "./python-dependent-fin-nat-rejection-source-history.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	pythonDependentFinNatRejectionHistoryPath, "utf8"));

test("Python dependent Fin repair records the exact failed acceptance path"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "python-dependent-fin-nat-rejection-source-v1");
		assert.equal(history.predecessorCommit
			, pythonDependentFinNatRejectionPredecessor);
		assert.equal(history.implementationCommit
			, pythonDependentFinNatRejectionImplementation);
		assert.deepEqual(history.failedRun, {
			workflow: 41170510578, job: 124447261240
		});
		assert.deepEqual(history.updates.map(item => item.path)
			, pythonDependentFinNatRejectionImplementationPaths);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, pythonDependentFinNatRejectionIntegrationPaths);
		assert.equal(history.runtimeChanged, false);
		assert.equal(history.liveSourcePins, 0);
	}
);

test("Python dependent Fin repair reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			pythonDependentFinNatRejectionImplementation, update.path), update)
			, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, pythonDependentFinNatRejectionImplementation + ":" + update.path]);
		assert.equal(reversePythonDependentFinNatRejectionUpdate(
			current, update), previous, update.path);
		assert.equal(beforePythonDependentFinNatRejectionSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("Python fixture classifies negative Nat before dependent Fin", async () => {
	const source = git(["show"
		, pythonDependentFinNatRejectionImplementation
		+ ":tests/fixtures/dependent-fin-consumers/python.py"]);
	assert.match(source, /except ValueError:\n\s+# A negative Nat[^\n]*\n\s+return False/u);
	assert.match(source, /raises\(ValueError[^\n]*mirror\(5, -1\)/u);
	assert.match(source, /not rejected\([^\n]*mirror\(5, -1\)/u);
	const contract = git(["show"
		, pythonDependentFinNatRejectionImplementation
		+ ":tests/managed-dependent-fin.test.mjs"]);
	assert.match(contract
		, /Python keeps a negative Nat distinct from a dependent Fin rejection/u);
});

test("Python fixture repair changes no published source pin or exact model"
	, async () => {
		const document = JSON.parse(await readFile(
			"docs/type-surface.v1.json", "utf8"));
		const live = typeSurfaceEvidenceFiles(document);
		for(const path of pythonDependentFinNatRejectionImplementationPaths)
			assert.equal(live.filter(file => file.path === path).length, 0, path);
		const history = await record();
		assert.deepEqual(history.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
	}
);

test("Python dependent Fin repair authenticates additions and rejects forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, pythonDependentFinNatRejectionHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, pythonDependentFinNatRejectionImplementation + ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reversePythonDependentFinNatRejectionUpdate(current, forged));
	}
);

test("Python dependent Fin history writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-python-dependent-fin-nat-rejection-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /python-dependent-fin-nat-rejection-source-history-20261031\.json/u);
});
