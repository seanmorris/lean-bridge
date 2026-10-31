#!/usr/bin/env node
/**
 * Record the dependent-Fin compiler-contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { typeSurfaceEvidenceFiles }
	from "../src/adoption/type-surface-evidence-receipt.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	dependentFinCompilerContractRepairHistoryAdditions
	, dependentFinCompilerContractRepairHistoryPath
	, dependentFinCompilerContractRepairImplementation
	, dependentFinCompilerContractRepairImplementationPaths
	, dependentFinCompilerContractRepairIntegrationPaths
	, dependentFinCompilerContractRepairPredecessor
} from "../tests/helpers/dependent-fin-compiler-contract-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-dependent-fin-compiler-contract-repair-source-history.mjs");
assert.equal(existsSync(dependentFinCompilerContractRepairHistoryPath), false
	, dependentFinCompilerContractRepairHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentFinCompilerContractRepairImplementation);
assert.equal(git(["rev-parse"
	, dependentFinCompilerContractRepairImplementation + "^"]).trim()
, dependentFinCompilerContractRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, dependentFinCompilerContractRepairPredecessor
	, dependentFinCompilerContractRepairImplementation, "--"])
, [...dependentFinCompilerContractRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, dependentFinCompilerContractRepairPredecessor
	, dependentFinCompilerContractRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, dependentFinCompilerContractRepairImplementation + ":"
		+ dependentFinCompilerContractRepairHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...dependentFinCompilerContractRepairIntegrationPaths])
, [...dependentFinCompilerContractRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...dependentFinCompilerContractRepairHistoryAdditions])
, [...dependentFinCompilerContractRepairHistoryAdditions].sort());

const inventoryPath = "docs/type-surface.v1.json";
const beforeInventory = JSON.parse(git(["show"
	, dependentFinCompilerContractRepairImplementation + ":" + inventoryPath]));
const afterInventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const restoredInventory = structuredClone(afterInventory);
const currentSourcePins = [{
	path: "tests/elaborated-metadata.test.mjs", count: 0
	, previous: "2e3e07dd5ea4b605210caade1651fbbdbfb00bc97acb11660b41b7287dbb2c6d"
	, current: sha256(await readFile("tests/elaborated-metadata.test.mjs"))
}];
assert.equal(currentSourcePins[0].current
	, "6b02ff75be5a3a9d95ae335208d0ce27a06b4aa505f07f036a19065eadd86c75");
assert.equal(beforeInventory.evidence.length, afterInventory.evidence.length);
for(const [evidenceIndex, beforeEvidence] of beforeInventory.evidence.entries())
{
	const afterEvidence = afterInventory.evidence[evidenceIndex];
	assert.equal(afterEvidence.id, beforeEvidence.id);
	assert.equal(afterEvidence.files.length, beforeEvidence.files.length);
	for(const [fileIndex, beforeFile] of beforeEvidence.files.entries())
	{
		const afterFile = afterEvidence.files[fileIndex];
		assert.equal(afterFile.path, beforeFile.path);
		const pin = currentSourcePins.find(item => item.path === beforeFile.path);
		if(pin === undefined) continue;
		assert.equal(beforeFile.sha256, pin.previous, beforeFile.path);
		assert.equal(afterFile.sha256, pin.current, beforeFile.path);
		restoredInventory.evidence[evidenceIndex].files[fileIndex].sha256
			= pin.previous;
		pin.count++;
	}
}
assert.deepEqual(currentSourcePins.map(item => item.count), [4]);
assert.deepEqual(restoredInventory, beforeInventory);

const liveFiles = typeSurfaceEvidenceFiles(afterInventory).filter(file =>
	!file.path.startsWith("docs/evidence/"));
const mismatches = [];
for(let offset = 0; offset < liveFiles.length; offset += 16)
{
	const batch = liveFiles.slice(offset, offset + 16);
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
assert.equal(liveFiles.length, 2661);
assert.deepEqual(mismatches, []);

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModel = git(["show"
	, dependentFinCompilerContractRepairImplementation + ":" + exactModelPath]);
assert.equal(sha256(exactModel)
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModel), 16916757);
const exact = JSON.parse(exactModel);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const implementationSources = new Map();
for(const path of dependentFinCompilerContractRepairImplementationPaths)
	implementationSources.set(path, git(["show"
		, dependentFinCompilerContractRepairImplementation + ":" + path]));
assert.equal([...implementationSources.values()].join("")
	.match(/dependent-type/gu)?.length, 1);
assert.match(implementationSources.get("tests/lake-wasm.test.mjs")
	, /Option \(Fin size\) := none", \/dependent-type\//u);

const updates = [];
for(const path of dependentFinCompilerContractRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, dependentFinCompilerContractRepairPredecessor
		, dependentFinCompilerContractRepairImplementation));
const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-fin-compiler-contract-repair-"));
try
{
	const environment = {
		...process.env, GIT_INDEX_FILE: join(directory, "index")
		, GIT_AUTHOR_NAME: "Lean Bridge history writer"
		, GIT_AUTHOR_EMAIL: "history@example.invalid"
		, GIT_COMMITTER_NAME: "Lean Bridge history writer"
		, GIT_COMMITTER_EMAIL: "history@example.invalid"
		, GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z"
		, GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z"
	};
	const temporaryGit = (arguments_, options = {}) => execFileSync(
		"git", arguments_, {
			encoding: "utf8", maxBuffer: 512 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", dependentFinCompilerContractRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...dependentFinCompilerContractRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", dependentFinCompilerContractRepairImplementation
	], { input: "Authenticate dependent-Fin compiler contracts\n" }).trim();
	const integrationUpdates = [];
	for(const path of dependentFinCompilerContractRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, dependentFinCompilerContractRepairImplementation
			, integrationCommit, { maximumEditBytes: 128 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of dependentFinCompilerContractRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(dependentFinCompilerContractRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "dependent-fin-compiler-contract-repair-source-v1"
		, predecessorCommit: dependentFinCompilerContractRepairPredecessor
		, implementationCommit: dependentFinCompilerContractRepairImplementation
		, failedRun: { workflow: 41181254244, job: 124481867425 }
		, failure: "Compiler acceptance correctly admitted direct dependent-Fin parameters while three negative expected-model cells still classified them as dependent-type failures."
		, scope: "Audit all 25 compiler-contract cases in one pass; retain dependent-type rejection for a genuinely unsupported dependent result; authenticate direct and specialized dependent-Fin parameters as supported; report every matrix cell independently; and preserve every support observation, evidence identity, stage and the frozen 1,054-cell/5,270-stage #1220 model."
		, runtimeChanged: false, liveSourcePins: 4
		, expectedModelAudit: {
			compilerContractCases: 25, staleExpectationsCorrected: 3
			, supportedDependentParameters: 2, unsupportedDependentResults: 1
		}
		, currentSourcePins, liveFiles: liveFiles.length
		, remainingLiveSourceMismatches: 0
		, exactModel: {
			sha256: sha256(exactModel), bytes: Buffer.byteLength(exactModel)
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write("Recorded " + updates.length
		+ " implementation transitions, " + integrationUpdates.length
		+ " integration transitions and four refreshed live citations.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
