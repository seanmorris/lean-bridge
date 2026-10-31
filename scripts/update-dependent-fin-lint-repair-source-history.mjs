#!/usr/bin/env node
/**
 * Record the dependent-Fin expected-model lint repair.
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
import {
	dependentFinLintRepairHistoryAdditions
	, dependentFinLintRepairHistoryPath
	, dependentFinLintRepairImplementation
	, dependentFinLintRepairImplementationPaths
	, dependentFinLintRepairIntegrationPaths
	, dependentFinLintRepairPredecessor
} from "../tests/helpers/dependent-fin-lint-repair-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-dependent-fin-lint-repair-source-history.mjs");
assert.equal(existsSync(dependentFinLintRepairHistoryPath), false
	, dependentFinLintRepairHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentFinLintRepairImplementation);
assert.equal(git(["rev-parse"
	, dependentFinLintRepairImplementation + "^"]).trim()
, dependentFinLintRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, dependentFinLintRepairPredecessor
	, dependentFinLintRepairImplementation, "--"])
, [...dependentFinLintRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, dependentFinLintRepairPredecessor
	, dependentFinLintRepairImplementation, "--"])
, []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, dependentFinLintRepairImplementation + ":" + dependentFinLintRepairHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...dependentFinLintRepairIntegrationPaths])
, [...dependentFinLintRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...dependentFinLintRepairHistoryAdditions])
, [...dependentFinLintRepairHistoryAdditions].sort());

const lint = spawnSync("npx", ["eslint", "tests/elaborated-metadata.test.mjs"]
	, { encoding: "utf8" });
assert.equal(lint.status, 0, lint.stdout + lint.stderr);

const inventoryPath = "docs/type-surface.v1.json";
const beforeInventory = JSON.parse(git(["show"
	, dependentFinLintRepairImplementation + ":" + inventoryPath]));
const afterInventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const restoredInventory = structuredClone(afterInventory);
const previousElaborated = sha256(git(["show"
	, dependentFinLintRepairPredecessor
		+ ":tests/elaborated-metadata.test.mjs"]));
const currentSourcePins = [{
	path: "tests/elaborated-metadata.test.mjs", count: 0
	, previous: previousElaborated
	, current: sha256(await readFile("tests/elaborated-metadata.test.mjs"))
}];
assert.equal(currentSourcePins[0].previous
	, "6b02ff75be5a3a9d95ae335208d0ce27a06b4aa505f07f036a19065eadd86c75");
assert.equal(currentSourcePins[0].current
	, "2571b2199c1c75788565db2a34a36096a70fa839f4b93d583d398226cf620d2e");
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
	, dependentFinLintRepairImplementation + ":" + exactModelPath]);
assert.equal(sha256(exactModel)
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModel), 16916757);
const exact = JSON.parse(exactModel);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const updates = [];
for(const path of dependentFinLintRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, dependentFinLintRepairPredecessor, dependentFinLintRepairImplementation));
const directory = await mkdtemp(join(tmpdir(), "lean-dependent-fin-lint-repair-"));
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
	temporaryGit(["read-tree", dependentFinLintRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...dependentFinLintRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", dependentFinLintRepairImplementation
	], { input: "Authenticate dependent-Fin lint repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of dependentFinLintRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, dependentFinLintRepairImplementation, integrationCommit
			, { maximumEditBytes: 128 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of dependentFinLintRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(dependentFinLintRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "dependent-fin-lint-repair-source-v1"
		, predecessorCommit: dependentFinLintRepairPredecessor
		, implementationCommit: dependentFinLintRepairImplementation
		, failedRun: { workflow: 41187496757, job: 124497398223
			, step: "Run inventory, lint, and checked JavaScript" }
		, failure: "The supported dependent-Fin specialization expectation exceeded the repository's column-80 grouped-list contract."
		, scope: "Reflow only the supported dependent-Fin refinement expectation, prove the exact static gate passes, refresh its four live citations, and preserve every support observation, evidence identity, stage and the frozen 1,054-cell/5,270-stage #1220 model."
		, runtimeChanged: false, semanticChanges: 0
		, lintCommand: "npx eslint tests/elaborated-metadata.test.mjs"
		, liveSourcePins: 4, currentSourcePins, liveFiles: liveFiles.length
		, remainingLiveSourceMismatches: 0
		, exactModel: {
			sha256: sha256(exactModel), bytes: Buffer.byteLength(exactModel)
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write("Recorded " + updates.length
		+ " implementation transition, " + integrationUpdates.length
		+ " integration transitions and four refreshed live citations.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
