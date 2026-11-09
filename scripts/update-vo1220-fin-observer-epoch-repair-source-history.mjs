#!/usr/bin/env node
/**
 * Record the strict-host current/historical Fin observer epoch repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	assertVo1220FinObserverEpochRepair
	, vo1220FinObserverEpochRepairBehavior as behavior
	, vo1220FinObserverEpochRepairHistoryAdditions as historyAdditions
	, vo1220FinObserverEpochRepairHistoryPath as historyPath
	, vo1220FinObserverEpochRepairImplementation as implementation
	, vo1220FinObserverEpochRepairImplementationPaths as implementationPaths
	, vo1220FinObserverEpochRepairIntegrationPaths as integrationPaths
	, vo1220FinObserverEpochRepairPredecessor as predecessor
} from "../tests/helpers/vo1220-fin-observer-epoch-repair-source-history.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const inventoryPath = "docs/type-surface.v1.json";
const baseDigest
	= "8ec3837e38f9a5127c54b8da375008f2e5321763481bf384b91292668b6ec64f";
const basePaths = Object.freeze([
	"docs/evidence/fin-container-edge-integration-20261010/source.tap"
	, "docs/evidence/fin-container-edges-measured-20261010/dotnet/report.json"
	, "docs/evidence/fin-container-edges-measured-20261010/php-native/report.json"
	, "docs/evidence/fin-container-edges-measured-20261010/ruby/report.json"
	, "docs/evidence/fin-container-foreign-measured-20261010/dotnet/report.json"
	, "docs/evidence/fin-container-foreign-measured-20261010/php-native/report.json"
	, "docs/evidence/fin-container-foreign-measured-20261010/ruby/report.json"
	, "docs/evidence/fin-dotnet-sdk-installed-20261010/report.json"
]);
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const blob = (commit, path) => git(["show", `${commit}:${path}`]);

assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...implementationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const sources = Object.fromEntries(implementationPaths.map(path => [
	path, blob(implementation, path)
]));
assert.deepEqual(assertVo1220FinObserverEpochRepair(sources), { ...behavior });
const actualBasePaths = git(["grep", "-l", baseDigest, implementation
	, "--", "docs/evidence"]).trim().split("\n").filter(Boolean)
	.map(line => line.slice(line.indexOf(":") + 1)).sort();
assert.deepEqual(actualBasePaths, basePaths);
const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(exactSources[0], exactSources[1]);
const exact = JSON.parse(exactSources[0]);
const inventorySources = [predecessor, implementation].map(commit =>
	blob(commit, inventoryPath));
assert.equal(inventorySources[0], inventorySources[1]);
assert.equal(await readFile(inventoryPath, "utf8"), inventorySources[1]);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-fin-observer-epoch-"));
try
{
	assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
		, "--", ...integrationPaths]), [...integrationPaths].sort());
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
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", implementation
	], { input: "Authenticate Fin observer epochs\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditionRecords = [];
	for(const path of historyAdditions)
		historyAdditionRecords.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "vo1220-fin-observer-epoch-repair-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			coreRun: 42539104695, job: 128918184542, shard: "5/12"
			, failedTests: 2
			, failedAssertion: "strict-root script digest and JVM host receipt"
		}
		, rootCause: "The live strict-root report verifier admitted only the current exact-child observer after that observer gained a process-exit receipt. Immutable Ruby, .NET and native-PHP reports were created by the exact pre-repair base observer and therefore failed the current script digest. The same shard also contained the separately repaired JVM receipt-layering failure. The restored hosted archive additionally predates the JVM public Option/null observation."
		, repair: "Keep current verification strict by requiring the wrapped observer and its exact successful process-exit receipt. Admit the pre-repair base observer only through an explicit historical-base epoch used after archive authentication; require its exact base digest and forbid retroactively acquired receipts. Preserve the JVM-specialized receipt selector and select the hosted archive's authenticated pre-Option/null row model."
		, behavior, changedSupportCells: behavior.changedSupportCells
		, runtimeSemanticChanges: behavior.runtimeSemanticChanges
		, retainedBaseObserver: { sha256: baseDigest, paths: basePaths }
		, exactModel: {
			sha256: sha256(exactSources[0]), bytes: Buffer.byteLength(exactSources[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, currentSourcePins: []
		, inventorySha256: {
			before: sha256(inventorySources[0]), after: sha256(inventorySources[1])
		}
		, validation: {
			strictObserverEpochControls: { tests: 1, pass: 1, fail: 0 }
			, measuredEdgeArchive: { tests: 3, pass: 3, fail: 0 }
			, measuredForeignArchive: { tests: 3, pass: 3, fail: 0 }
			, hostedFinArchive: { tests: 5, pass: 5, fail: 0 }
			, jvmPendingExitArchive: { tests: 2, pass: 2, fail: 0 }
			, focusedEslint: "passed", checkedJavaScriptTypecheck: "passed"
		}
		, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
