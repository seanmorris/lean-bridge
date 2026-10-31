/**
 * Authenticate the dependent-Fin compiler-contract repair.
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
	beforeDependentFinCompilerContractRepairSource
	, dependentFinCompilerContractRepairHistoryAdditions
	, dependentFinCompilerContractRepairHistoryPath
	, dependentFinCompilerContractRepairImplementation
	, dependentFinCompilerContractRepairImplementationPaths
	, dependentFinCompilerContractRepairIntegrationPaths
	, dependentFinCompilerContractRepairPredecessor
	, reverseDependentFinCompilerContractRepairUpdate
} from "./dependent-fin-compiler-contract-repair-source-history.mjs";
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
	dependentFinCompilerContractRepairHistoryPath, "utf8"));

test("dependent Fin compiler repair records the exact failed acceptance path"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "dependent-fin-compiler-contract-repair-source-v1");
		assert.equal(history.predecessorCommit
			, dependentFinCompilerContractRepairPredecessor);
		assert.equal(history.implementationCommit
			, dependentFinCompilerContractRepairImplementation);
		assert.deepEqual(history.failedRun, {
			workflow: 41181254244, job: 124481867425
		});
		assert.deepEqual(history.updates.map(item => item.path)
			, dependentFinCompilerContractRepairImplementationPaths);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, dependentFinCompilerContractRepairIntegrationPaths);
		assert.equal(history.runtimeChanged, false);
		assert.deepEqual(history.expectedModelAudit, {
			compilerContractCases: 25
			, staleExpectationsCorrected: 3
			, supportedDependentParameters: 2
			, unsupportedDependentResults: 1
		});
	}
);

test("dependent Fin compiler repair reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
	{
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			dependentFinCompilerContractRepairImplementation, update.path), update)
		, true, update.path);
		const current = git(["show"
			, dependentFinCompilerContractRepairImplementation + ":" + update.path]);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), git(["show"
			, dependentFinCompilerContractRepairPredecessor + ":" + update.path]));
	}
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, dependentFinCompilerContractRepairImplementation + ":" + update.path]);
		assert.equal(reverseDependentFinCompilerContractRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDependentFinCompilerContractRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("dependent Fin compiler matrix retains one real dependent rejection"
	, () => {
		const elaborated = git(["show"
			, dependentFinCompilerContractRepairImplementation
				+ ":tests/elaborated-metadata.test.mjs"]);
		const lake = git(["show"
			, dependentFinCompilerContractRepairImplementation
				+ ":tests/lake-wasm.test.mjs"]);
		assert.equal((elaborated + lake).match(/dependent-type/gu)?.length, 1);
		assert.match(lake
			, /Option \(Fin size\) := none", \/dependent-type\//u);
		assert.match(lake, /timeout: 360000/u);
		assert.match(elaborated
			, /parameters: \[null, \{ kind: "fin-parameter", parameter: 0 \}\], result: null/u);
		assert.match(elaborated
			, /parameters: \[null, \{ kind: "fin-parameter", parameter: 0 \}, null\], result: null/u);
		assert.match(elaborated
			, /for\(const \[name, reason\] of expected\)\n\s*await t\.test\(name/u);
		assert.match(elaborated
			, /for\(const \[name, , , reason\] of rejected\)\n\s*await t\.test\(name/u);
	}
);

test("dependent Fin compiler repair refreshes exactly four live citations"
	, async () => {
		const history = await record();
		assert.equal(history.liveSourcePins, 4);
		assert.deepEqual(history.currentSourcePins, [{
			path: "tests/elaborated-metadata.test.mjs", count: 4
			, previous: "2e3e07dd5ea4b605210caade1651fbbdbfb00bc97acb11660b41b7287dbb2c6d"
			, current: "6b02ff75be5a3a9d95ae335208d0ce27a06b4aa505f07f036a19065eadd86c75"
		}]);
		const document = JSON.parse(await readFile(
			"docs/type-surface.v1.json", "utf8"));
		const citations = document.evidence.flatMap(evidence => evidence.files)
			.filter(file =>
				file.path === "tests/elaborated-metadata.test.mjs");
		assert.equal(citations.length, 4);
		assert.deepEqual([...new Set(citations.map(file => file.sha256))]
			, [history.currentSourcePins[0].current]);
		assert.equal(typeSurfaceEvidenceFiles(document).filter(file =>
			file.path === "tests/elaborated-metadata.test.mjs").length, 1);
		assert.deepEqual(history.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
	}
);

test("dependent Fin compiler repair leaves every live source pin current"
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

test("dependent Fin compiler repair authenticates additions and rejects forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, dependentFinCompilerContractRepairHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, dependentFinCompilerContractRepairImplementation + ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseDependentFinCompilerContractRepairUpdate(current, forged));
	}
);

test("dependent Fin compiler repair writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-dependent-fin-compiler-contract-repair-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /dependent-fin-compiler-contract-repair-source-history-20261031\.json/u);
});
