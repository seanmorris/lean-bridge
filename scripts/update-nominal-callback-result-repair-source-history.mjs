#!/usr/bin/env node
/**
 * Record the nominal callback-result refinement repair.
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
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	assertNominalCallbackResultRepair
	, nominalCallbackResultRepairHistoryAdditions
	, nominalCallbackResultRepairHistoryPath
	, nominalCallbackResultRepairImplementation
	, nominalCallbackResultRepairImplementationPaths
	, nominalCallbackResultRepairIntegrationPaths
	, nominalCallbackResultRepairPinAdditions
	, nominalCallbackResultRepairPinCommit
	, nominalCallbackResultRepairPinPaths
	, nominalCallbackResultRepairPredecessor
} from "../tests/helpers/nominal-callback-result-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-nominal-callback-result-repair-source-history.mjs");
assert.equal(existsSync(nominalCallbackResultRepairHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, nominalCallbackResultRepairPinCommit);
assert.equal(git(["rev-parse"
	, `${nominalCallbackResultRepairImplementation}^`]).trim()
, nominalCallbackResultRepairPredecessor);
assert.equal(git(["rev-parse"
	, `${nominalCallbackResultRepairPinCommit}^`]).trim()
, nominalCallbackResultRepairImplementation);
assert.deepEqual(names(["diff", "--name-only"
	, nominalCallbackResultRepairPredecessor
	, nominalCallbackResultRepairImplementation, "--"])
, [...nominalCallbackResultRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only"
	, nominalCallbackResultRepairImplementation
	, nominalCallbackResultRepairPinCommit, "--"])
, [...nominalCallbackResultRepairPinPaths
	, ...nominalCallbackResultRepairPinAdditions].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...nominalCallbackResultRepairIntegrationPaths])
, [...nominalCallbackResultRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...nominalCallbackResultRepairHistoryAdditions])
, [...nominalCallbackResultRepairHistoryAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${nominalCallbackResultRepairPinCommit}:${
		nominalCallbackResultRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);

const implementationSource = path => git(["show"
	, `${nominalCallbackResultRepairImplementation}:${path}`]);
assertNominalCallbackResultRepair(...
nominalCallbackResultRepairImplementationPaths.map(implementationSource));

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModels = [
	nominalCallbackResultRepairPredecessor
	, nominalCallbackResultRepairImplementation
	, nominalCallbackResultRepairPinCommit
].map(commit => git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
assert.equal(sha256(exactModels[0])
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModels[0]), 16916757);
const exact = JSON.parse(exactModels[0]);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const updates = [];
for(const path of nominalCallbackResultRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, nominalCallbackResultRepairPredecessor
		, nominalCallbackResultRepairImplementation));
const pinUpdates = [];
for(const path of nominalCallbackResultRepairPinPaths)
	pinUpdates.push(await gitSourceHistoryTransition(path
		, nominalCallbackResultRepairImplementation
		, nominalCallbackResultRepairPinCommit));
const pinAdditions = [];
for(const path of nominalCallbackResultRepairPinAdditions)
	pinAdditions.push({
		path
		, sha256: sha256(git(["show"
			, `${nominalCallbackResultRepairPinCommit}:${path}`]))
	});

const directory = await mkdtemp(join(
	tmpdir(), "lean-nominal-callback-result-history-"));
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
	temporaryGit(["read-tree", nominalCallbackResultRepairPinCommit]);
	temporaryGit(["add", "--sparse", "--"
		, ...nominalCallbackResultRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", nominalCallbackResultRepairPinCommit
	], { input: "Authenticate nominal callback-result repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of nominalCallbackResultRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, nominalCallbackResultRepairPinCommit, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of nominalCallbackResultRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(nominalCallbackResultRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "nominal-callback-result-repair-v1"
		, predecessorCommit: nominalCallbackResultRepairPredecessor
		, implementationCommit: nominalCallbackResultRepairImplementation
		, pinCommit: nominalCallbackResultRepairPinCommit, integrationCommit
		, discovery: {
			run: 41275246725, job: 124761649316
			, workflow: "Downstream consumer contract"
			, contract: "checked Fin callbacks and closures compile, reproduce and recover in installed npm packages"
			, observed: "raw nominal callback reply outside Fin bound returned normally"
			, expected: "status 5 expectation violation"
		}
		, rootCause: "The Lean wrapper retained compiler-normalized shared nominal Fin mirrors, but the native callback trampoline independently stripped those refinements because copied-graph structure validation was assumed to enforce them. Structural validation checks shape, not nominal Fin bounds, so raw internal callback replies bypassed the public JavaScript validator and invalid values reached Lean recovery."
		, repair: {
			mirror: "compiler-normalized shared nominal refinements"
			, boundary: "native callback result trampoline"
			, violationStatus: 5, refreshedLiveCitations: 7
		}
		, localValidation: {
			before: "installed nominal npm callback contract reproduced the missing throw"
			, after: "installed scalar and nominal npm callback contracts passed"
			, nominalArchiveSha256: "1648d39368f2723e64c9d73ba741b7ee0f446a83990f624b7b85b72e31a99b00"
		}
		, exactModel: {
			sha256: sha256(exactModels[0])
			, bytes: Buffer.byteLength(exactModels[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, changedSupportCells: 0, runtimeSemanticChanges: 1
		, updates, pinUpdates, pinAdditions, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation, `
		+ `${pinUpdates.length} pin and ${integrationUpdates.length} integration `
		+ "transitions for the nominal callback-result repair.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
