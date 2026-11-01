#!/usr/bin/env node
/**
 * Record the consecutive Python callback sanitizer and TAP CI repairs.
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
	assertPythonCallbackTapContractRepair
	, pythonCallbackTapContractRepairHistoryAdditions
	, pythonCallbackTapContractRepairHistoryPath
	, pythonCallbackTapContractRepairImplementation
	, pythonCallbackTapContractRepairImplementationPaths
	, pythonCallbackTapContractRepairIntegrationPaths
	, pythonCallbackTapContractRepairPredecessor
	, pythonCallbackTapContractRepairSanitizerCommit
	, pythonCallbackTapContractRepairSanitizerPaths
	, pythonCallbackTapContractRepairTapPaths
} from "../tests/helpers/python-callback-tap-contract-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-python-callback-tap-contract-repair-source-history.mjs");
assert.equal(existsSync(pythonCallbackTapContractRepairHistoryPath), false
	, "Python callback TAP repair history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, pythonCallbackTapContractRepairImplementation);
assert.equal(git(["rev-parse"
	, `${pythonCallbackTapContractRepairImplementation}^`]).trim()
, pythonCallbackTapContractRepairSanitizerCommit);
assert.equal(git(["rev-parse"
	, `${pythonCallbackTapContractRepairSanitizerCommit}^`]).trim()
, pythonCallbackTapContractRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, pythonCallbackTapContractRepairPredecessor
	, pythonCallbackTapContractRepairImplementation, "--"])
, [...pythonCallbackTapContractRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only"
	, pythonCallbackTapContractRepairPredecessor
	, pythonCallbackTapContractRepairSanitizerCommit, "--"])
, [...pythonCallbackTapContractRepairSanitizerPaths].sort());
assert.deepEqual(names(["diff", "--name-only"
	, pythonCallbackTapContractRepairSanitizerCommit
	, pythonCallbackTapContractRepairImplementation, "--"])
, [...pythonCallbackTapContractRepairTapPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...pythonCallbackTapContractRepairIntegrationPaths])
, [...pythonCallbackTapContractRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...pythonCallbackTapContractRepairHistoryAdditions])
, [...pythonCallbackTapContractRepairHistoryAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${pythonCallbackTapContractRepairImplementation}:${
		pythonCallbackTapContractRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);

const implementationSources = Object.fromEntries(
	pythonCallbackTapContractRepairImplementationPaths.map(path => [path
		, git(["show"
			, `${pythonCallbackTapContractRepairImplementation}:${path}`])])
);
assertPythonCallbackTapContractRepair(implementationSources);

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModels = [
	pythonCallbackTapContractRepairPredecessor
	, pythonCallbackTapContractRepairSanitizerCommit
	, pythonCallbackTapContractRepairImplementation
].map(commit => git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
assert.equal(sha256(exactModels[0])
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModels[0]), 16916757);
const exact = JSON.parse(exactModels[0]);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const sanitizerUpdates = [];
for(const path of pythonCallbackTapContractRepairSanitizerPaths)
	sanitizerUpdates.push(await gitSourceHistoryTransition(path
		, pythonCallbackTapContractRepairPredecessor
		, pythonCallbackTapContractRepairSanitizerCommit
		, { maximumEditBytes: 64 * 1024 * 1024 }));
const updates = [];
for(const path of pythonCallbackTapContractRepairTapPaths)
	updates.push(await gitSourceHistoryTransition(path
		, pythonCallbackTapContractRepairSanitizerCommit
		, pythonCallbackTapContractRepairImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-python-callback-tap-contract-history-"));
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
	temporaryGit(["read-tree", pythonCallbackTapContractRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...pythonCallbackTapContractRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", pythonCallbackTapContractRepairImplementation
	], { input: "Authenticate Python callback TAP contract repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of pythonCallbackTapContractRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, pythonCallbackTapContractRepairImplementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of pythonCallbackTapContractRepairHistoryAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${pythonCallbackTapContractRepairImplementation}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(pythonCallbackTapContractRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "python-callback-ci-contract-repair-source-v1"
		, predecessorCommit: pythonCallbackTapContractRepairPredecessor
		, sanitizerCommit: pythonCallbackTapContractRepairSanitizerCommit
		, implementationCommit: pythonCallbackTapContractRepairImplementation
		, integrationCommit
		, discovery: {
			sanitizer: {
				lane: "Callback-result lifetimes in installed Python wheels"
				, observed: "CPython startup Unicode cache varied between equivalent executions"
			}
			, tap: {
				run: 41336197205, job: 124937486225
				, lane: "Callback-result lifetimes in installed Python wheels"
				, observed: "14 passing TAP tests followed by an exact 13-test gate failure"
			}
		}
		, replayDiscovery: [
			{ run: 41342383365, job: 124955948626
				, lane: "Native PHP callback-result acceptance" }
			, { run: 41342383365, job: 124962612878
				, lane: "PHP-Wasm callback-result packages" }
			, { run: 41342383365, job: 124962612805
				, lane: "WIT and WASI Component Model" }
		]
		, rootCause: "CPython can retain a variable three-frame Unicode startup cache that is unrelated to the generated/native callback runtime, while the evidence compared complete sanitizer output byte-for-byte. The resulting repair and the subsequent nonzero TAP gate changed seven current sources without recording either reversible transition, so older PHP, PHP-Wasm and WIT readers stopped at the new digests."
		, repair: "Retain complete sanitizer diagnostics but compare them after removing only exact three-frame CPython Unicode startup allocations and their derived total; keep native/generated frames and explicit ASan, UBSan, 73-byte and 89-byte probes strict. Require a nonzero TAP suite whose test and pass counts agree and whose negative counters are zero. Record both consecutive transitions newest-first in the shared history normalizer."
		, exactModel: {
			sha256: sha256(exactModels[0])
			, bytes: Buffer.byteLength(exactModels[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, changedSupportCells: 0, runtimeSemanticChanges: 0
		, livePinRefreshes: 92
		, validation: {
			focusedAudits: "6/6 exact-head workflows passed"
			, pythonTap: "14 tests, 14 pass, zero negative counters"
			, sharedReplayEndpoints: 8
		}
		, sanitizerUpdates, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${sanitizerUpdates.length} sanitizer, `
		+ `${updates.length} TAP and `
		+ `${integrationUpdates.length} integration transitions for the `
		+ "Python callback CI repairs.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
