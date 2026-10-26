/**
 * Authenticate the Core historical-evidence replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeCoreRuntimeBudgetLivePinRepairSource
	, coreRuntimeBudgetLivePinRepairAddedPaths
	, coreRuntimeBudgetLivePinRepairHistoryPath
	, coreRuntimeBudgetLivePinRepairImplementation
	, coreRuntimeBudgetLivePinRepairImplementationPaths
	, coreRuntimeBudgetLivePinRepairIntegrationPaths
	, coreRuntimeBudgetLivePinRepairPredecessor
	, reverseCoreRuntimeBudgetLivePinRepairUpdate
} from "./core-runtime-budget-live-pin-repair-source-history.mjs";
import {
	beforeCoreReceiverCiStopBoundarySource
	, coreReceiverCiStopBoundaryAddedPaths
	, coreReceiverCiStopBoundaryHistoryPath
	, coreReceiverCiStopBoundaryImplementation
	, coreReceiverCiStopBoundaryImplementationPaths
	, coreReceiverCiStopBoundaryIntegrationPaths
	, coreReceiverCiStopBoundaryPredecessor
	, reverseCoreReceiverCiStopBoundaryUpdate
} from "./core-receiver-ci-stop-boundary-source-history.mjs";
import {
	beforeCoreWitBorrowStopBoundarySource
	, coreWitBorrowStopBoundaryAddedPaths
	, coreWitBorrowStopBoundaryHistoryPath
	, coreWitBorrowStopBoundaryImplementation
	, coreWitBorrowStopBoundaryImplementationPaths
	, coreWitBorrowStopBoundaryIntegrationPaths
	, coreWitBorrowStopBoundaryPredecessor
	, reverseCoreWitBorrowStopBoundaryUpdate
} from "./core-wit-borrow-stop-boundary-source-history.mjs";
import {
	beforeCoreReceiverCiProducerReplaySource
	, coreReceiverCiProducerReplayAddedPaths
	, coreReceiverCiProducerReplayHistoryPath
	, coreReceiverCiProducerReplayImplementation
	, coreReceiverCiProducerReplayImplementationPaths
	, coreReceiverCiProducerReplayIntegrationPaths
	, coreReceiverCiProducerReplayPredecessor
	, reverseCoreReceiverCiProducerReplayUpdate
} from "./core-receiver-ci-producer-replay-source-history.mjs";
import {
	beforeCoreWitBorrowProducerReplaySource
	, coreWitBorrowProducerReplayAddedPaths
	, coreWitBorrowProducerReplayHistoryPath
	, coreWitBorrowProducerReplayImplementation
	, coreWitBorrowProducerReplayImplementationPaths
	, coreWitBorrowProducerReplayIntegrationPaths
	, coreWitBorrowProducerReplayPredecessor
	, reverseCoreWitBorrowProducerReplayUpdate
} from "./core-wit-borrow-producer-replay-source-history.mjs";
import {
	beforeCoreExactHeadLivePinRepairSource
	, coreExactHeadLivePinRepairAddedPaths
	, coreExactHeadLivePinRepairHistoryPath
	, coreExactHeadLivePinRepairImplementation
	, coreExactHeadLivePinRepairImplementationPaths
	, coreExactHeadLivePinRepairIntegrationPaths
	, coreExactHeadLivePinRepairPredecessor
	, reverseCoreExactHeadLivePinRepairUpdate
} from "./core-exact-head-live-pin-repair-source-history.mjs";
import {
	beforeCoreHistoricalEvidenceReplaySource
	, coreHistoricalEvidenceReplayAddedPaths
	, coreHistoricalEvidenceReplayHistoryPath
	, coreHistoricalEvidenceReplayImplementation
	, coreHistoricalEvidenceReplayImplementationPaths
	, coreHistoricalEvidenceReplayIntegrationPaths
	, coreHistoricalEvidenceReplayPredecessor
	, reverseCoreHistoricalEvidenceReplayUpdate
} from "./core-historical-evidence-replay-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { gitSourceHistoryTransition } from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	coreHistoricalEvidenceReplayHistoryPath, "utf8"
));
const readRuntimeBudgetLivePinRepair = async () => JSON.parse(await readFile(
	coreRuntimeBudgetLivePinRepairHistoryPath, "utf8"
));
const readLivePinRepair = async () => JSON.parse(await readFile(
	coreExactHeadLivePinRepairHistoryPath, "utf8"
));
const readWitBorrowProducerReplay = async () => JSON.parse(await readFile(
	coreWitBorrowProducerReplayHistoryPath, "utf8"
));
const readReceiverCiProducerReplay = async () => JSON.parse(await readFile(
	coreReceiverCiProducerReplayHistoryPath, "utf8"
));
const readWitBorrowStopBoundary = async () => JSON.parse(await readFile(
	coreWitBorrowStopBoundaryHistoryPath, "utf8"
));
const readReceiverCiStopBoundary = async () => JSON.parse(await readFile(
	coreReceiverCiStopBoundaryHistoryPath, "utf8"
));

test("Core historical replay records its exact source range", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-historical-evidence-replay-source-v1");
	assert.equal(record.predecessorCommit
		, coreHistoricalEvidenceReplayPredecessor);
	assert.equal(record.implementationCommit
		, coreHistoricalEvidenceReplayImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreHistoricalEvidenceReplayImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreHistoricalEvidenceReplayIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreHistoricalEvidenceReplayAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreHistoricalEvidenceReplayImplementation}^`]).trim()
	, coreHistoricalEvidenceReplayPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, coreHistoricalEvidenceReplayPredecessor
		, coreHistoricalEvidenceReplayImplementation]).trim().split("\n")
	, [...coreHistoricalEvidenceReplayImplementationPaths].sort());
});

test("Core historical replay reverses every source transition", async () => {
	const record = await read();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreHistoricalEvidenceReplaySource);
		const base = record.integrationUpdates.includes(update)
			? coreHistoricalEvidenceReplayImplementation
			: coreHistoricalEvidenceReplayPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreHistoricalEvidenceReplayUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Core historical replay binds the immutable producer parents", async () => {
	assert.equal(git(["show", "-s", "--format=%P"
		, "511f43f1b02a6bddb5517f47a497e8eda766a065"]).trim()
	, "de6ec9dde00779476152481876de339f4cb82656");
	assert.equal(git(["show", "-s", "--format=%P"
		, "a3100134f1853102fc2cbf0c2f12839ac480af12"]).trim()
	, "93589825d4b4c028724390e4c8d886213cbc92d8");
	const cpp = await readFile("tests/helpers/owned-cpp-evidence.mjs", "utf8");
	const rust = await readFile(
		"tests/helpers/owned-rust-callback-result-acceptance.mjs", "utf8");
	const python = await readFile(
		"tests/owned-python-transfer-evidence.test.mjs", "utf8");
	assert.match(cpp, /511f43f1b02a6bddb5517f47a497e8eda766a065/u);
	assert.match(rust, /a3100134f1853102fc2cbf0c2f12839ac480af12/u);
	assert.match(python
		, /await readFile\(update\.path, "utf8"\), update\.currentSha256/u);
});

test("Core historical replay rejects altered transitions", async () => {
	const update = (await read()).updates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCoreHistoricalEvidenceReplaySource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreHistoricalEvidenceReplayUpdate(
			current, forged));
	assert.equal(beforeCoreHistoricalEvidenceReplaySource(
		update.path, current + "unknown"), current + "unknown");
});

test("Core historical replay writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-historical-replay-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-historical-evidence-replay-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("exact-head Core live-pin repair changes three references only", async () => {
	const previous = git(["show"
		, `${coreExactHeadLivePinRepairPredecessor}:docs/type-surface.v1.json`]);
	const current = git(["show"
		, `${coreExactHeadLivePinRepairImplementation}:docs/type-surface.v1.json`]);
	const oldDigest
		= "5f0c703ca8eea060a7fdcfa1bfbf5d9d1413f935091064e859ccc013127b7632";
	const newDigest
		= "205e9c7a110260c81b27447db39b479d2957431bee9e54116d49023f1f4cc46b";
	assert.equal(previous.split(oldDigest).length - 1, 3);
	assert.equal(current.split(newDigest).length - 1, 3);
	assert.equal(previous.replaceAll(oldDigest, newDigest), current);
	const path = "docs/type-surface.v1.json";
	assert.equal(sha256(current), sha256(beforeFinRefinementSource(
		path, await readFile(path, "utf8"), sha256(current)
	)));
});

test("exact-head Core live-pin repair records and reverses its range", async () => {
	const record = await readLivePinRepair();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-exact-head-live-pin-repair-source-v1");
	assert.equal(record.predecessorCommit
		, coreExactHeadLivePinRepairPredecessor);
	assert.equal(record.implementationCommit
		, coreExactHeadLivePinRepairImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreExactHeadLivePinRepairImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreExactHeadLivePinRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreExactHeadLivePinRepairAddedPaths);
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreExactHeadLivePinRepairSource);
		const base = record.integrationUpdates.includes(update)
			? coreExactHeadLivePinRepairImplementation
			: coreExactHeadLivePinRepairPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreExactHeadLivePinRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
});

test("exact-head Core live-pin repair rejects altered transitions", async () => {
	const update = (await readLivePinRepair()).updates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCoreExactHeadLivePinRepairSource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreExactHeadLivePinRepairUpdate(
			current, forged));
	assert.equal(beforeCoreExactHeadLivePinRepairSource(
		update.path, current + "unknown"), current + "unknown");
});

test("exact-head Core live-pin writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-exact-head-live-pin-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-exact-head-live-pin-repair-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Core runtime-budget registration repairs exactly three live pins", async () => {
	const path = "docs/type-surface.v1.json";
	const previous = git(["show"
		, `${coreRuntimeBudgetLivePinRepairPredecessor}:${path}`]);
	const current = git(["show"
		, `${coreRuntimeBudgetLivePinRepairImplementation}:${path}`]);
	const oldDigest
		= "205e9c7a110260c81b27447db39b479d2957431bee9e54116d49023f1f4cc46b";
	const newDigest
		= "38906f02fa9e17c275d7785526e042e4819f5b6e15881d76dae2326e73277368";
	assert.equal(previous.split(oldDigest).length - 1, 3);
	assert.equal(current.split(newDigest).length - 1, 3);
	assert.equal(previous.replaceAll(oldDigest, newDigest), current);
	const componentPath = "tests/component-array-contract.test.mjs";
	const component = git(["show"
		, `${coreRuntimeBudgetLivePinRepairImplementation}:${componentPath}`]);
	assert.equal(sha256(component), newDigest);
	assert.equal(component, git(["show"
		, `${coreRuntimeBudgetLivePinRepairPredecessor}:${componentPath}`]));
	assert.equal(sha256(current), sha256(beforeFinRefinementSource(
		path, await readFile(path, "utf8"), sha256(current)
	)));
});

test("Core runtime-budget live-pin repair records and reverses its range", async () => {
	const record = await readRuntimeBudgetLivePinRepair();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-runtime-budget-live-pin-repair-source-v1");
	assert.equal(record.predecessorCommit
		, coreRuntimeBudgetLivePinRepairPredecessor);
	assert.equal(record.implementationCommit
		, coreRuntimeBudgetLivePinRepairImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreRuntimeBudgetLivePinRepairImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreRuntimeBudgetLivePinRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreRuntimeBudgetLivePinRepairAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreRuntimeBudgetLivePinRepairImplementation}^`]).trim()
	, coreRuntimeBudgetLivePinRepairPredecessor);
	assert.deepEqual(await gitSourceHistoryTransition(
		"docs/type-surface.v1.json"
		, coreRuntimeBudgetLivePinRepairPredecessor
		, coreRuntimeBudgetLivePinRepairImplementation), record.updates[0]);
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreRuntimeBudgetLivePinRepairSource);
		const previous = git(["show"
			, `${coreRuntimeBudgetLivePinRepairImplementation}:${update.path}`]);
		assert.equal(reverseCoreRuntimeBudgetLivePinRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Core runtime-budget live-pin repair rejects alteration", async () => {
	const update = (await readRuntimeBudgetLivePinRepair())
		.integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCoreRuntimeBudgetLivePinRepairSource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreRuntimeBudgetLivePinRepairUpdate(
			current, forged));
	assert.equal(beforeCoreRuntimeBudgetLivePinRepairSource(
		update.path, current + "unknown"), current + "unknown");
});

test("Core runtime-budget live-pin writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-runtime-budget-live-pin-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-runtime-budget-live-pin-repair-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Core WIT borrow replay records its exact source range", async () => {
	const record = await readWitBorrowProducerReplay();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-wit-borrow-producer-replay-source-v1");
	assert.equal(record.predecessorCommit
		, coreWitBorrowProducerReplayPredecessor);
	assert.equal(record.implementationCommit
		, coreWitBorrowProducerReplayImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreWitBorrowProducerReplayImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreWitBorrowProducerReplayIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreWitBorrowProducerReplayAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreWitBorrowProducerReplayImplementation}^`]).trim()
	, coreWitBorrowProducerReplayPredecessor);
});

test("Core WIT borrow replay reverses every source transition", async () => {
	const record = await readWitBorrowProducerReplay();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreWitBorrowProducerReplaySource);
		const base = record.integrationUpdates.includes(update)
			? coreWitBorrowProducerReplayImplementation
			: coreWitBorrowProducerReplayPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreWitBorrowProducerReplayUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
});

test("Core WIT borrow replay binds the immutable producer", () => {
	assert.equal(git(["show", "-s", "--format=%H"
		, "1e6f7f5f5f916461dae4a567916db3dc6d4cfa6d"]).trim()
	, "1e6f7f5f5f916461dae4a567916db3dc6d4cfa6d");
	const source = git(["show"
		, `${coreWitBorrowProducerReplayImplementation}:tests/wit-owned-borrow-evidence.test.mjs`]);
	assert.match(source, /ownedTransferBorrowProducers\.wit\.revision/u);
	assert.match(source, /bytesAtProducer\(producer, path, identity\)/u);
	assert.match(source, /sourceAtProducer\(/u);
	assert.doesNotMatch(source, /ownedReceiverHistoricalBytes/u);
});

test("Core WIT borrow replay rejects altered transitions", async () => {
	const update = (await readWitBorrowProducerReplay()).updates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCoreWitBorrowProducerReplaySource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreWitBorrowProducerReplayUpdate(
			current, forged));
	assert.equal(beforeCoreWitBorrowProducerReplaySource(
		update.path, current + "unknown"), current + "unknown");
});

test("Core WIT borrow replay writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-wit-borrow-replay-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-wit-borrow-producer-replay-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Core receiver-CI replay records its exact source range", async () => {
	const record = await readReceiverCiProducerReplay();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-receiver-ci-producer-replay-source-v1");
	assert.equal(record.predecessorCommit
		, coreReceiverCiProducerReplayPredecessor);
	assert.equal(record.implementationCommit
		, coreReceiverCiProducerReplayImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreReceiverCiProducerReplayImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreReceiverCiProducerReplayIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreReceiverCiProducerReplayAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreReceiverCiProducerReplayImplementation}^`]).trim()
	, coreReceiverCiProducerReplayPredecessor);
});

test("Core receiver-CI replay reverses every source transition", async () => {
	const record = await readReceiverCiProducerReplay();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreReceiverCiProducerReplaySource);
		const base = record.integrationUpdates.includes(update)
			? coreReceiverCiProducerReplayImplementation
			: coreReceiverCiProducerReplayPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreReceiverCiProducerReplayUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
});

test("Core receiver-CI replay binds the immutable producer", () => {
	assert.equal(git(["show", "-s", "--format=%H"
		, "c1725cc2ed8122cf656bfc62446f36069987c53a"]).trim()
	, "c1725cc2ed8122cf656bfc62446f36069987c53a");
	const source = git(["show"
		, `${coreReceiverCiProducerReplayImplementation}:tests/owned-perl-receiver-ci.test.mjs`]);
	assert.match(source
		, /const producer = "c1725cc2ed8122cf656bfc62446f36069987c53a"/u);
	assert.match(source, /bytesAtProducer\(producer, path, digest\)/u);
	assert.match(source, /sourceAtProducer\(/u);
	assert.doesNotMatch(source, /ownedPhpWasmReceiverHistoricalBytes/u);
});

test("Core receiver-CI replay rejects altered transitions", async () => {
	const update = (await readReceiverCiProducerReplay()).updates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCoreReceiverCiProducerReplaySource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreReceiverCiProducerReplayUpdate(
			current, forged));
	assert.equal(beforeCoreReceiverCiProducerReplaySource(
		update.path, current + "unknown"), current + "unknown");
});

test("Core receiver-CI replay writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-receiver-ci-replay-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-receiver-ci-producer-replay-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Core WIT stop boundary records its exact source range", async () => {
	const record = await readWitBorrowStopBoundary();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-wit-borrow-stop-boundary-source-v1");
	assert.equal(record.predecessorCommit
		, coreWitBorrowStopBoundaryPredecessor);
	assert.equal(record.implementationCommit
		, coreWitBorrowStopBoundaryImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreWitBorrowStopBoundaryImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreWitBorrowStopBoundaryIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreWitBorrowStopBoundaryAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreWitBorrowStopBoundaryImplementation}^`]).trim()
	, coreWitBorrowStopBoundaryPredecessor);
});

test("Core WIT stop boundary reverses every source transition", async () => {
	const record = await readWitBorrowStopBoundary();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreWitBorrowStopBoundarySource);
		const base = record.integrationUpdates.includes(update)
			? coreWitBorrowStopBoundaryImplementation
			: coreWitBorrowStopBoundaryPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreWitBorrowStopBoundaryUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
});

test("Core WIT stop boundary selects exact transition endpoints", () => {
	const source = git(["show"
		, `${coreWitBorrowStopBoundaryImplementation}:tests/wit-owned-borrow-evidence.test.mjs`]);
	assert.match(source
		, /prior = reverseOwnedWitBorrowUpdate\(source, update\)/u);
	assert.match(source
		, /update\.path, source, update\.previousSha256\), prior/u);
	assert.match(source
		, /update\.path, prior, update\.previousSha256\), prior/u);
	assert.match(source
		, /const prior = JSON\.parse\(reverseOwnedWitBorrowUpdate\(current, update\)\)/u);
});

test("Core WIT stop boundary rejects altered transitions", async () => {
	const update = (await readWitBorrowStopBoundary()).updates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCoreWitBorrowStopBoundarySource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreWitBorrowStopBoundaryUpdate(
			current, forged));
	assert.equal(beforeCoreWitBorrowStopBoundarySource(
		update.path, current + "unknown"), current + "unknown");
});

test("Core WIT stop-boundary writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-wit-stop-boundary-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-wit-borrow-stop-boundary-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Core receiver-CI stop boundary records its exact source range", async () => {
	const record = await readReceiverCiStopBoundary();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-receiver-ci-stop-boundary-source-v1");
	assert.equal(record.predecessorCommit
		, coreReceiverCiStopBoundaryPredecessor);
	assert.equal(record.implementationCommit
		, coreReceiverCiStopBoundaryImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreReceiverCiStopBoundaryImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreReceiverCiStopBoundaryIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreReceiverCiStopBoundaryAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreReceiverCiStopBoundaryImplementation}^`]).trim()
	, coreReceiverCiStopBoundaryPredecessor);
});

test("Core receiver-CI stop boundary reverses every source transition", async () => {
	const record = await readReceiverCiStopBoundary();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreReceiverCiStopBoundarySource);
		const base = record.integrationUpdates.includes(update)
			? coreReceiverCiStopBoundaryImplementation
			: coreReceiverCiStopBoundaryPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreReceiverCiStopBoundaryUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
});

test("Core receiver-CI stop boundary selects exact transition endpoints", () => {
	const source = git(["show"
		, `${coreReceiverCiStopBoundaryImplementation}:tests/owned-perl-receiver-ci.test.mjs`]);
	assert.match(source
		, /prior = reverseOwnedReceiverCiRepair\(source, update\)/u);
	assert.match(source
		, /update\.path, source, update\.previousSha256\n\t\t\), prior/u);
	assert.match(source
		, /update\.path, prior, update\.previousSha256\n\t\t\), prior/u);
	assert.match(source
		, /const prior = JSON\.parse\(reverseOwnedReceiverCiRepair\(current, update\)\)/u);
});

test("Core receiver-CI stop boundary rejects altered transitions", async () => {
	const update = (await readReceiverCiStopBoundary()).updates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCoreReceiverCiStopBoundarySource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreReceiverCiStopBoundaryUpdate(
			current, forged));
	assert.equal(beforeCoreReceiverCiStopBoundarySource(
		update.path, current + "unknown"), current + "unknown");
});

test("Core receiver-CI stop-boundary writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-receiver-ci-stop-boundary-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-receiver-ci-stop-boundary-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
