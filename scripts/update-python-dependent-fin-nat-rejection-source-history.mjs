#!/usr/bin/env node
/**
 * Record the Python dependent-Fin Nat-rejection repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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
	pythonDependentFinNatRejectionHistoryAdditions
	, pythonDependentFinNatRejectionHistoryPath
	, pythonDependentFinNatRejectionImplementation
	, pythonDependentFinNatRejectionImplementationPaths
	, pythonDependentFinNatRejectionIntegrationPaths
	, pythonDependentFinNatRejectionPredecessor
} from "../tests/helpers/python-dependent-fin-nat-rejection-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-python-dependent-fin-nat-rejection-source-history.mjs");
assert.equal(existsSync(pythonDependentFinNatRejectionHistoryPath), false
	, pythonDependentFinNatRejectionHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, pythonDependentFinNatRejectionImplementation);
assert.equal(git(["rev-parse"
	, pythonDependentFinNatRejectionImplementation + "^"]).trim()
, pythonDependentFinNatRejectionPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, pythonDependentFinNatRejectionPredecessor
	, pythonDependentFinNatRejectionImplementation, "--"])
, [...pythonDependentFinNatRejectionImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, pythonDependentFinNatRejectionPredecessor
	, pythonDependentFinNatRejectionImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, pythonDependentFinNatRejectionImplementation + ":"
		+ pythonDependentFinNatRejectionHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...pythonDependentFinNatRejectionIntegrationPaths])
, [...pythonDependentFinNatRejectionIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...pythonDependentFinNatRejectionHistoryAdditions])
, [...pythonDependentFinNatRejectionHistoryAdditions].sort());

const typeSurface = JSON.parse(await readFile(
	"docs/type-surface.v1.json", "utf8"));
const liveFiles = typeSurfaceEvidenceFiles(typeSurface);
for(const path of pythonDependentFinNatRejectionImplementationPaths)
	assert.equal(liveFiles.filter(file => file.path === path).length, 0, path);
const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModel = git(["show"
	, pythonDependentFinNatRejectionImplementation + ":" + exactModelPath]);
assert.equal(sha256(exactModel)
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModel), 16916757);
const exact = JSON.parse(exactModel);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const updates = [];
for(const path of pythonDependentFinNatRejectionImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, pythonDependentFinNatRejectionPredecessor
		, pythonDependentFinNatRejectionImplementation));
const directory = await mkdtemp(join(
	tmpdir(), "lean-python-dependent-fin-nat-rejection-"));
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
	temporaryGit(["read-tree", pythonDependentFinNatRejectionImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...pythonDependentFinNatRejectionIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", pythonDependentFinNatRejectionImplementation
	], { input: "Authenticate Python dependent-Fin Nat rejection\n" }).trim();
	const integrationUpdates = [];
	for(const path of pythonDependentFinNatRejectionIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, pythonDependentFinNatRejectionImplementation, integrationCommit));
	const historyAdditions = [];
	for(const path of pythonDependentFinNatRejectionHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(pythonDependentFinNatRejectionHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "python-dependent-fin-nat-rejection-source-v1"
		, predecessorCommit: pythonDependentFinNatRejectionPredecessor
		, implementationCommit: pythonDependentFinNatRejectionImplementation
		, failedRun: { workflow: 41170510578, job: 124447261240 }
		, failure: "Python ValueError escaped the fixture's dependent-Fin rejection classifier"
		, scope: "Keep negative Python integers in the existing Nat ValueError path and classify that path as distinct from LeanBridgeError dependent-Fin rejection. Change only the installed Python caller and its static contract; preserve generated runtime code, every support cell, stage, evidence identity, live source pin and the frozen #1220 model."
		, runtimeChanged: false, liveSourcePins: 0
		, exactModel: {
			sha256: sha256(exactModel), bytes: Buffer.byteLength(exactModel)
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write("Recorded " + updates.length
		+ " implementation transitions and " + integrationUpdates.length
		+ " integration transitions without changing runtime or support.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
