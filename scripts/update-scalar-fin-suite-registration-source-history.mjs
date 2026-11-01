#!/usr/bin/env node
/**
 * Record the retained Scalar Fin suite registration repair.
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
	assertScalarFinSuiteRegistration
	, scalarFinSuiteRegistrationHistoryAdditions
	, scalarFinSuiteRegistrationHistoryPath
	, scalarFinSuiteRegistrationImplementation
	, scalarFinSuiteRegistrationImplementationPaths
	, scalarFinSuiteRegistrationIntegrationPaths
	, scalarFinSuiteRegistrationPredecessor
} from "../tests/helpers/scalar-fin-suite-registration-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-scalar-fin-suite-registration-source-history.mjs");
assert.equal(existsSync(scalarFinSuiteRegistrationHistoryPath), false
	, "Scalar Fin suite registration history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, scalarFinSuiteRegistrationImplementation);
assert.equal(git(["rev-parse"
	, `${scalarFinSuiteRegistrationImplementation}^`]).trim()
, scalarFinSuiteRegistrationPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, scalarFinSuiteRegistrationPredecessor
	, scalarFinSuiteRegistrationImplementation, "--"])
, [...scalarFinSuiteRegistrationImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...scalarFinSuiteRegistrationIntegrationPaths])
, [...scalarFinSuiteRegistrationIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...scalarFinSuiteRegistrationHistoryAdditions])
, [...scalarFinSuiteRegistrationHistoryAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${scalarFinSuiteRegistrationImplementation}:${
		scalarFinSuiteRegistrationHistoryPath}`]
, { stdio: "ignore" }).status, 0);

assertScalarFinSuiteRegistration(git(["show"
	, `${scalarFinSuiteRegistrationImplementation}:src/adoption/test-profiles.mjs`]));
const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModels = [
	scalarFinSuiteRegistrationPredecessor
	, scalarFinSuiteRegistrationImplementation
].map(commit => git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
assert.equal(sha256(exactModels[0])
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModels[0]), 16916757);
const exact = JSON.parse(exactModels[0]);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const updates = [];
for(const path of scalarFinSuiteRegistrationImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, scalarFinSuiteRegistrationPredecessor
		, scalarFinSuiteRegistrationImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-scalar-fin-suite-registration-history-"));
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
	temporaryGit(["read-tree", scalarFinSuiteRegistrationImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...scalarFinSuiteRegistrationIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", scalarFinSuiteRegistrationImplementation
	], { input: "Authenticate retained Scalar Fin suite registration\n" }).trim();
	const integrationUpdates = [];
	for(const path of scalarFinSuiteRegistrationIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, scalarFinSuiteRegistrationImplementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of scalarFinSuiteRegistrationHistoryAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${scalarFinSuiteRegistrationImplementation}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	const currentSourcePins = [{
		path: "src/adoption/test-profiles.mjs", count: 98
		, previous: "cd2afbdcbd40042ec7bf9b9eb31882d688cb155a970ad8d09f154eb43f748cdb"
		, current: "3ec58789494f149af921fcab0cafe14231663217a20c90280f3157d90a290aa9"
	}];
	const inventory = await readFile("docs/type-surface.v1.json", "utf8");
	assert.equal(inventory.split(currentSourcePins[0].previous).length - 1, 0);
	assert.equal(inventory.split(currentSourcePins[0].current).length - 1, 98);
	await writeFile(scalarFinSuiteRegistrationHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "scalar-fin-suite-registration-source-v1"
		, predecessorCommit: scalarFinSuiteRegistrationPredecessor
		, implementationCommit: scalarFinSuiteRegistrationImplementation
		, integrationCommit
		, discovery: {
			workflow: 41302411524, job: 124836045756
			, failure: "tests/scalar-fin-source-entry.test.mjs was absent from the closed repository test-profile manifest"
		}
		, rootCause: "The retained evidence suite was introduced as a Core-discovered repository test, but its name was not added to the closed test-profile manifest. Static quality therefore rejected the new file before contract sharding."
		, repair: "Register the retained suite exactly once in the Core contract profile and refresh every current live-source citation without changing runtime semantics or support claims."
		, exactModel: {
			sha256: sha256(exactModels[0])
			, bytes: Buffer.byteLength(exactModels[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, changedSupportCells: 0, runtimeSemanticChanges: 0
		, livePinRefreshes: 98, currentSourcePins
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation update and `
		+ `${integrationUpdates.length} integration transitions for the `
		+ "retained Scalar Fin suite registration repair.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
