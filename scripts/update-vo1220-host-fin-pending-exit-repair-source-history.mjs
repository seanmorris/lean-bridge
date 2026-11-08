#!/usr/bin/env node
/**
 * Record the host Fin pending-exit measurement repair and its one live pin.
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
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "../tests/helpers/dependent-checked-record-promotion.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	assertVo1220HostFinPendingExitRepair
	, vo1220HostFinPendingExitRepairBehavior as behavior
	, vo1220HostFinPendingExitRepairHistoryAdditions as historyAdditions
	, vo1220HostFinPendingExitRepairHistoryPath as historyPath
	, vo1220HostFinPendingExitRepairImplementation as implementation
	, vo1220HostFinPendingExitRepairImplementationPaths as implementationPaths
	, vo1220HostFinPendingExitRepairIntegrationPaths as integrationPaths
	, vo1220HostFinPendingExitRepairPredecessor as predecessor
} from "../tests/helpers/vo1220-host-fin-pending-exit-repair-source-history.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const inventoryPath = "docs/type-surface.v1.json";
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
assert.deepEqual(assertVo1220HostFinPendingExitRepair(sources)
	, { ...behavior });
const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(exactSources[0], exactSources[1]);
const exact = JSON.parse(exactSources[0]);
const beforeInventorySource = blob(implementation, inventoryPath);
assert.equal(await readFile(inventoryPath, "utf8"), beforeInventorySource
	, "Inventory must equal the implementation commit before sealing");
const beforeInventory = JSON.parse(beforeInventorySource);
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	beforeInventory, implementationPaths
);
assert.deepEqual(currentSourcePaths, ["tests/ruby-fin.test.mjs"]);
assert.equal(currentSourcePaths.length, behavior.currentSourcePaths);
const currentDigests = new Map(currentSourcePaths.map(path => [
	path, sha256(blob(implementation, path))
]));
const currentSourcePins = [];
for(const path of currentSourcePaths)
{
	const pins = beforeInventory.evidence.flatMap(evidence => evidence.files)
		.filter(file => file.path === path);
	const previous = new Set(pins.map(file => file.sha256));
	assert.equal(previous.size, 1, path);
	assert.equal([...previous][0], sha256(blob(predecessor, path)), path);
	currentSourcePins.push({
		path, count: pins.length, previous: [...previous][0]
		, current: currentDigests.get(path)
	});
}
const reconciled = reconcileDependentCheckedRecordSourcePins(
	beforeInventory, currentDigests
);
assert.equal(reconciled.refreshed, behavior.refreshedPins);
const afterInventorySource = JSON.stringify(reconciled.inventory, null, 2) + "\n";

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-host-fin-pending-exit-"));
let inventoryWritten = false;
try
{
	await writeFile(inventoryPath, afterInventorySource);
	inventoryWritten = true;
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
	], { input: "Authenticate host Fin pending-exit repair\n" }).trim();
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
		, milestone: "vo1220-host-fin-pending-exit-repair-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			downstreamRun: 42491758784, job: 128769573430
			, profile: "managed-dotnet", step: "type_corpus_dotnet"
			, priorJvmRepair: "616dd5ee55dfe8ca1adbb126f448e6af25ec27ba"
			, observedExit: 72, diagnostic: "No unwaited-for children left"
		}
		, rootCause: "The non-extracting scalar and container GDB observers still trusted only GDB convenience variables at process exit. A managed .NET consumer completed with valid output and counters, but the known GDB Linux lost-last-thread race omitted its normal exit event, so the measurement returned 72 after the product behavior had passed. The JVM-specific observer already recovered the same race with an exact-child pidfd, but that mechanism had not been applied to ordinary host probes."
		, repair: "Preserve the raw scalar, container and JVM-specialized templates, then wrap ordinary fixed-root host probes with the existing exact-child design under host-neutral names. Bind a pidfd while the inferior is stopped; accept the unchanged GDB normal-exit path; recover only an otherwise empty debugger state through waitid(P_PIDFD, WEXITED|WNOHANG|WNOWAIT); require CLD_EXITED and matching PID/UID; save and independently validate processExit in the armed manifest. Signals, live children, stale or consumed status, wrong handles, nonzero exits and instrumentation failures still fail closed."
		, behavior, changedSupportCells: behavior.changedSupportCells
		, runtimeSemanticChanges: behavior.runtimeSemanticChanges
		, exactModel: {
			sha256: sha256(exactSources[0]), bytes: Buffer.byteLength(exactSources[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, currentSourcePins
		, inventorySha256: {
			before: sha256(beforeInventorySource), after: sha256(afterInventorySource)
		}
		, validation: {
			kernelExitControls: { tests: 20, pass: 20, fail: 0 }
			, nativeObserverTests: { tests: 4, pass: 4, fail: 0 }
			, scalarContainerEquivalence: "passed"
			, jvmSpecializedLayering: "passed"
			, focusedEslint: "passed", checkedJavaScriptTypecheck: "passed"
		}
		, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} integration transitions and `
		+ `${reconciled.refreshed} live-pin refresh.\n`);
}
catch(error)
{
	if(inventoryWritten) await writeFile(inventoryPath, beforeInventorySource);
	throw error;
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
