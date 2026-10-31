/**
 * Authenticate the dependent-Fin expected-model lint repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { typeSurfaceEvidenceFiles }
	from "../../src/adoption/type-surface-evidence-receipt.mjs";
import {
	beforeDependentFinLintRepairSource
	, dependentFinLintRepairHistoryAdditions
	, dependentFinLintRepairHistoryPath
	, dependentFinLintRepairImplementation
	, dependentFinLintRepairImplementationPaths
	, dependentFinLintRepairIntegrationPaths
	, dependentFinLintRepairPredecessor
	, reverseDependentFinLintRepairUpdate
} from "./dependent-fin-lint-repair-source-history.mjs";
import { beforeFinRefinementSource }
	from "./fin-refinement-source-history.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	dependentFinLintRepairHistoryPath, "utf8"));

test("dependent Fin lint repair records the exact static-gate failure"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone, "dependent-fin-lint-repair-source-v1");
		assert.equal(history.predecessorCommit
			, dependentFinLintRepairPredecessor);
		assert.equal(history.implementationCommit
			, dependentFinLintRepairImplementation);
		assert.deepEqual(history.failedRun, {
			workflow: 41187496757, job: 124497398223
			, step: "Run inventory, lint, and checked JavaScript"
		});
		assert.deepEqual(history.updates.map(item => item.path)
			, dependentFinLintRepairImplementationPaths);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, dependentFinLintRepairIntegrationPaths);
	}
);

test("dependent Fin lint repair reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
	{
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			dependentFinLintRepairImplementation, update.path), update)
		, true, update.path);
		const current = git(["show"
			, dependentFinLintRepairImplementation + ":" + update.path]);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), git(["show"
			, dependentFinLintRepairPredecessor + ":" + update.path]));
	}
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, dependentFinLintRepairImplementation + ":" + update.path]);
		assert.equal(reverseDependentFinLintRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDependentFinLintRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("dependent Fin lint repair satisfies the exact static contract", () => {
	const source = git(["show"
		, dependentFinLintRepairImplementation
			+ ":tests/elaborated-metadata.test.mjs"]);
	assert.match(source
		, /parameters: \[\n\s+null, \{ kind: "fin-parameter", parameter: 0 \}, null\n\s+\]\n\s+, result: null/u);
	const lint = spawnSync("npx", ["eslint"
		, "tests/elaborated-metadata.test.mjs"], { encoding: "utf8" });
	assert.equal(lint.status, 0, lint.stdout + lint.stderr);
});

test("dependent Fin lint repair refreshes exactly four live citations"
	, async () => {
		const history = await record();
		assert.equal(history.liveSourcePins, 4);
		assert.deepEqual(history.currentSourcePins, [{
			path: "tests/elaborated-metadata.test.mjs", count: 4
			, previous: "6b02ff75be5a3a9d95ae335208d0ce27a06b4aa505f07f036a19065eadd86c75"
			, current: "2571b2199c1c75788565db2a34a36096a70fa839f4b93d583d398226cf620d2e"
		}]);
		assert.deepEqual(history.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
	}
);

test("dependent Fin lint repair leaves every live source pin current"
	, async () => {
		const document = JSON.parse(await readFile(
			"docs/type-surface.v1.json", "utf8"));
		const files = typeSurfaceEvidenceFiles(document).filter(file =>
			!file.path.startsWith("docs/evidence/"));
		const mismatches = [];
		for(let offset = 0; offset < files.length; offset += 16)
		{
			const batch = files.slice(offset, offset + 16);
			const actual = await Promise.all(batch.map(async file => {
				try
				{
					return createHash("sha256").update(
						await readFile(file.path)).digest("hex");
				}
				catch(error)
				{ return `missing:${error.code}`; }
			}));
			for(const [index, file] of batch.entries())
				if(actual[index] !== file.sha256)
					mismatches.push({ path: file.path
						, actual: actual[index], expected: file.sha256 });
		}
		assert.equal(files.length, 2661);
		assert.deepEqual(mismatches, []);
	}
);

test("dependent Fin lint repair authenticates additions and rejects forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, dependentFinLintRepairHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, dependentFinLintRepairImplementation + ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseDependentFinLintRepairUpdate(current, forged));
	}
);

test("dependent Fin lint repair writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-dependent-fin-lint-repair-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /dependent-fin-lint-repair-source-history-20261031\.json/u);
});
