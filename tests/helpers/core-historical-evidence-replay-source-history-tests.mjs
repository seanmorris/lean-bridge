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
	beforeCoreBrowserWorkflowEvidencePinRepairSource
	, coreBrowserWorkflowEvidencePinRepairAddedPaths
	, coreBrowserWorkflowEvidencePinRepairHistoryPath
	, coreBrowserWorkflowEvidencePinRepairImplementation
	, coreBrowserWorkflowEvidencePinRepairImplementationPaths
	, coreBrowserWorkflowEvidencePinRepairIntegrationPaths
	, coreBrowserWorkflowEvidencePinRepairPredecessor
	, reverseCoreBrowserWorkflowEvidencePinRepairUpdate
} from "./core-browser-workflow-evidence-pin-repair-source-history.mjs";
import {
	beforeCoreTypeSurfaceEvidenceClosureRepairSource
	, coreTypeSurfaceEvidenceClosureRepairAddedPaths
	, coreTypeSurfaceEvidenceClosureRepairHistoryPath
	, coreTypeSurfaceEvidenceClosureRepairImplementation
	, coreTypeSurfaceEvidenceClosureRepairImplementationPaths
	, coreTypeSurfaceEvidenceClosureRepairIntegrationPaths
	, coreTypeSurfaceEvidenceClosureRepairPredecessor
	, reverseCoreTypeSurfaceEvidenceClosureRepairUpdate
} from "./core-type-surface-evidence-closure-repair-source-history.mjs";
import {
	beforeCoreSparseConeModeRepairSource
	, coreSparseConeModeRepairAddedPaths
	, coreSparseConeModeRepairHistoryPath
	, coreSparseConeModeRepairImplementation
	, coreSparseConeModeRepairImplementationPaths
	, coreSparseConeModeRepairIntegrationPaths
	, coreSparseConeModeRepairPredecessor
	, reverseCoreSparseConeModeRepairUpdate
} from "./core-sparse-cone-mode-repair-source-history.mjs";
import {
	beforeCoreContractEvidenceCheckoutSource
	, coreContractEvidenceCheckoutAddedPaths
	, coreContractEvidenceCheckoutHistoryPath
	, coreContractEvidenceCheckoutImplementation
	, coreContractEvidenceCheckoutImplementationAdditions
	, coreContractEvidenceCheckoutImplementationPaths
	, coreContractEvidenceCheckoutIntegrationPaths
	, coreContractEvidenceCheckoutModifiedPaths
	, coreContractEvidenceCheckoutPredecessor
	, reverseCoreContractEvidenceCheckoutUpdate
} from "./core-contract-evidence-checkout-source-history.mjs";
import {
	beforeNominalPrimitiveSubtypeSparseCheckoutSource
	, nominalPrimitiveSubtypeSparseCheckoutAddedPaths
	, nominalPrimitiveSubtypeSparseCheckoutHistoryPath
	, nominalPrimitiveSubtypeSparseCheckoutImplementation
	, nominalPrimitiveSubtypeSparseCheckoutImplementationAdditions
	, nominalPrimitiveSubtypeSparseCheckoutImplementationPaths
	, nominalPrimitiveSubtypeSparseCheckoutIntegrationPaths
	, nominalPrimitiveSubtypeSparseCheckoutModifiedPaths
	, nominalPrimitiveSubtypeSparseCheckoutPredecessor
	, nominalPrimitiveSubtypeSparseCheckoutWorkflowPaths
	, reverseNominalPrimitiveSubtypeSparseCheckoutUpdate
} from "./nominal-primitive-subtype-sparse-checkout-source-history.mjs";
import {
	beforeCoreStaticSparseCheckoutSource
	, coreStaticSparseCheckoutAddedPaths
	, coreStaticSparseCheckoutHistoryPath
	, coreStaticSparseCheckoutImplementation
	, coreStaticSparseCheckoutImplementationPaths
	, coreStaticSparseCheckoutIntegrationPaths
	, coreStaticSparseCheckoutPredecessor
	, reverseCoreStaticSparseCheckoutUpdate
} from "./core-static-sparse-checkout-source-history.mjs";
import {
	beforeCoreStaticHistoryDeferralSource
	, coreStaticHistoryDeferralAddedPaths
	, coreStaticHistoryDeferralHistoryPath
	, coreStaticHistoryDeferralImplementation
	, coreStaticHistoryDeferralImplementationPaths
	, coreStaticHistoryDeferralIntegrationPaths
	, coreStaticHistoryDeferralPredecessor
	, reverseCoreStaticHistoryDeferralUpdate
} from "./core-static-history-deferral-source-history.mjs";
import {
	beforeCoreOwnedReviewedExactStopRepairSource
	, coreOwnedReviewedExactStopRepairAddedPaths
	, coreOwnedReviewedExactStopRepairHistoryPath
	, coreOwnedReviewedExactStopRepairImplementation
	, coreOwnedReviewedExactStopRepairImplementationPaths
	, coreOwnedReviewedExactStopRepairIntegrationPaths
	, coreOwnedReviewedExactStopRepairPredecessor
	, reverseCoreOwnedReviewedExactStopRepairUpdate
} from "./core-owned-reviewed-exact-stop-repair-source-history.mjs";
import {
	beforeCoreWitExactStopRepairSource
	, coreWitExactStopRepairAddedPaths
	, coreWitExactStopRepairHistoryPath
	, coreWitExactStopRepairImplementation
	, coreWitExactStopRepairImplementationPaths
	, coreWitExactStopRepairIntegrationPaths
	, coreWitExactStopRepairPredecessor
	, reverseCoreWitExactStopRepairUpdate
} from "./core-wit-exact-stop-repair-source-history.mjs";
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
	assertNominalPrimitiveSubtypeHistoryCheckout
} from "./nominal-primitive-subtype-history-checkout.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { gitSourceHistoryTransition } from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
const readCoreBrowserWorkflowEvidencePinRepair = async () => JSON.parse(
	await readFile(coreBrowserWorkflowEvidencePinRepairHistoryPath, "utf8")
);
const readCoreTypeSurfaceEvidenceClosureRepair = async () => JSON.parse(
	await readFile(coreTypeSurfaceEvidenceClosureRepairHistoryPath, "utf8")
);
const readCoreSparseConeModeRepair = async () => JSON.parse(await readFile(
	coreSparseConeModeRepairHistoryPath, "utf8"));
const readCoreContractEvidenceCheckout = async () => JSON.parse(await readFile(
	coreContractEvidenceCheckoutHistoryPath, "utf8"));
const readNominalPrimitiveSubtypeSparseCheckout = async () =>
	JSON.parse(await readFile(
		nominalPrimitiveSubtypeSparseCheckoutHistoryPath, "utf8"));
const readStaticSparseCheckout = async () => JSON.parse(await readFile(
	coreStaticSparseCheckoutHistoryPath, "utf8"
));
const readStaticHistoryDeferral = async () => JSON.parse(await readFile(
	coreStaticHistoryDeferralHistoryPath, "utf8"
));
const readOwnedReviewedExactStopRepair = async () => JSON.parse(await readFile(
	coreOwnedReviewedExactStopRepairHistoryPath, "utf8"
));
const readWitExactStopRepair = async () => JSON.parse(await readFile(
	coreWitExactStopRepairHistoryPath, "utf8"
));
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

test("Core browser workflow pin records its source range", async () => {
	const record = await readCoreBrowserWorkflowEvidencePinRepair();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-browser-workflow-evidence-pin-repair-source-v1");
	assert.equal(record.predecessorCommit
		, coreBrowserWorkflowEvidencePinRepairPredecessor);
	assert.equal(record.implementationCommit
		, coreBrowserWorkflowEvidencePinRepairImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreBrowserWorkflowEvidencePinRepairImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreBrowserWorkflowEvidencePinRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreBrowserWorkflowEvidencePinRepairAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreBrowserWorkflowEvidencePinRepairImplementation}^`]).trim()
	, coreBrowserWorkflowEvidencePinRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, coreBrowserWorkflowEvidencePinRepairPredecessor
		, coreBrowserWorkflowEvidencePinRepairImplementation])
		.trim().split("\n").sort()
	, [...coreBrowserWorkflowEvidencePinRepairImplementationPaths].sort());
});

test("Core browser workflow pin reverses every transition", async () => {
	const record = await readCoreBrowserWorkflowEvidencePinRepair();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreBrowserWorkflowEvidencePinRepairSource);
		const base = record.integrationUpdates.includes(update)
			? coreBrowserWorkflowEvidencePinRepairImplementation
			: coreBrowserWorkflowEvidencePinRepairPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreBrowserWorkflowEvidencePinRepairUpdate(
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

test("Core browser workflow pin rejects altered transitions", async () => {
	const update
		= (await readCoreBrowserWorkflowEvidencePinRepair()).updates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCoreBrowserWorkflowEvidencePinRepairSource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreBrowserWorkflowEvidencePinRepairUpdate(
			current, forged));
	assert.equal(beforeCoreBrowserWorkflowEvidencePinRepairSource(
		update.path, current + "unknown"), current + "unknown");
});

test("Core browser workflow pin writer rejects another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-browser-workflow-pin-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-browser-workflow-evidence-pin-repair-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Core type-surface closure records its source range", async () => {
	const record = await readCoreTypeSurfaceEvidenceClosureRepair();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-type-surface-evidence-closure-repair-source-v1");
	assert.equal(record.predecessorCommit
		, coreTypeSurfaceEvidenceClosureRepairPredecessor);
	assert.equal(record.implementationCommit
		, coreTypeSurfaceEvidenceClosureRepairImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreTypeSurfaceEvidenceClosureRepairImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreTypeSurfaceEvidenceClosureRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreTypeSurfaceEvidenceClosureRepairAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreTypeSurfaceEvidenceClosureRepairImplementation}^`]).trim()
	, coreTypeSurfaceEvidenceClosureRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, coreTypeSurfaceEvidenceClosureRepairPredecessor
		, coreTypeSurfaceEvidenceClosureRepairImplementation])
		.trim().split("\n").sort()
	, [...coreTypeSurfaceEvidenceClosureRepairImplementationPaths].sort());
});

test("Core type-surface closure reverses every transition", async () => {
	const record = await readCoreTypeSurfaceEvidenceClosureRepair();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreTypeSurfaceEvidenceClosureRepairSource);
		const base = record.integrationUpdates.includes(update)
			? coreTypeSurfaceEvidenceClosureRepairImplementation
			: coreTypeSurfaceEvidenceClosureRepairPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreTypeSurfaceEvidenceClosureRepairUpdate(
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

test("Core type-surface closure rejects altered transitions", async () => {
	const update = (await readCoreTypeSurfaceEvidenceClosureRepair()).updates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCoreTypeSurfaceEvidenceClosureRepairSource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreTypeSurfaceEvidenceClosureRepairUpdate(
			current, forged));
	assert.equal(beforeCoreTypeSurfaceEvidenceClosureRepairSource(
		update.path, current + "unknown"), current + "unknown");
});

test("Core type-surface closure writer rejects another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-type-surface-closure-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-type-surface-evidence-closure-repair-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Core sparse cone-mode repair records its exact source range", async () => {
	const record = await readCoreSparseConeModeRepair();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-sparse-cone-mode-repair-source-v1");
	assert.equal(record.predecessorCommit
		, coreSparseConeModeRepairPredecessor);
	assert.equal(record.implementationCommit
		, coreSparseConeModeRepairImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreSparseConeModeRepairImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreSparseConeModeRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreSparseConeModeRepairAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreSparseConeModeRepairImplementation}^`]).trim()
	, coreSparseConeModeRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, coreSparseConeModeRepairPredecessor
		, coreSparseConeModeRepairImplementation]).trim().split("\n").sort()
	, [...coreSparseConeModeRepairImplementationPaths].sort());
});

test("Core sparse cone-mode repair reverses every transition", async () => {
	const record = await readCoreSparseConeModeRepair();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreSparseConeModeRepairSource);
		const base = record.integrationUpdates.includes(update)
			? coreSparseConeModeRepairImplementation
			: coreSparseConeModeRepairPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreSparseConeModeRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Core sparse cone-mode repair rejects altered transitions", async () => {
	const update = (await readCoreSparseConeModeRepair()).updates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCoreSparseConeModeRepairSource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreSparseConeModeRepairUpdate(
			current, forged));
	assert.equal(beforeCoreSparseConeModeRepairSource(
		update.path, current + "unknown"), current + "unknown");
});

test("Core sparse cone-mode writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-sparse-cone-mode-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-sparse-cone-mode-repair-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Core evidence checkout records its exact 47-file implementation", async () => {
	const record = await readCoreContractEvidenceCheckout();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-contract-evidence-checkout-source-v1");
	assert.equal(record.predecessorCommit
		, coreContractEvidenceCheckoutPredecessor);
	assert.equal(record.implementationCommit
		, coreContractEvidenceCheckoutImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreContractEvidenceCheckoutModifiedPaths);
	assert.deepEqual(record.implementationAdditions.map(addition => addition.path)
		, coreContractEvidenceCheckoutImplementationAdditions);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreContractEvidenceCheckoutIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreContractEvidenceCheckoutAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreContractEvidenceCheckoutImplementation}^`]).trim()
	, coreContractEvidenceCheckoutPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, coreContractEvidenceCheckoutPredecessor
		, coreContractEvidenceCheckoutImplementation]).trim()
		.split("\n").sort()
	, [...coreContractEvidenceCheckoutImplementationPaths].sort());
	assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
		, coreContractEvidenceCheckoutPredecessor
		, coreContractEvidenceCheckoutImplementation]).trim()
		.split("\n").sort()
	, [...coreContractEvidenceCheckoutModifiedPaths].sort());
});

test("Core evidence checkout reverses every source transition", async () => {
	const record = await readCoreContractEvidenceCheckout();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreContractEvidenceCheckoutSource);
		const base = record.integrationUpdates.includes(update)
			? coreContractEvidenceCheckoutImplementation
			: coreContractEvidenceCheckoutPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreContractEvidenceCheckoutUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of [
		...record.implementationAdditions, ...record.additions
	]) assert.equal(sha256(await sourceAtFinHistoryMilestone(
		addition.path, addition.currentSha256))
	, addition.currentSha256, addition.path);
});

test("Core evidence checkout rejects altered transitions", async () => {
	const update = (await readCoreContractEvidenceCheckout()).updates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCoreContractEvidenceCheckoutSource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreContractEvidenceCheckoutUpdate(
			current, forged));
	assert.equal(beforeCoreContractEvidenceCheckoutSource(
		update.path, current + "unknown"), current + "unknown");
});

test("Core evidence-checkout writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-contract-evidence-checkout-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-contract-evidence-checkout-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("primitive Subtype sparse checkout records its exact source range", async () => {
	const record = await readNominalPrimitiveSubtypeSparseCheckout();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "nominal-primitive-subtype-sparse-checkout-source-v1");
	assert.equal(record.predecessorCommit
		, nominalPrimitiveSubtypeSparseCheckoutPredecessor);
	assert.equal(record.implementationCommit
		, nominalPrimitiveSubtypeSparseCheckoutImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, nominalPrimitiveSubtypeSparseCheckoutModifiedPaths);
	assert.deepEqual(record.implementationAdditions.map(addition => addition.path)
		, nominalPrimitiveSubtypeSparseCheckoutImplementationAdditions);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, nominalPrimitiveSubtypeSparseCheckoutIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, nominalPrimitiveSubtypeSparseCheckoutAddedPaths);
	assert.equal(git(["rev-parse"
		, `${nominalPrimitiveSubtypeSparseCheckoutImplementation}^`]).trim()
	, nominalPrimitiveSubtypeSparseCheckoutPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, nominalPrimitiveSubtypeSparseCheckoutPredecessor
		, nominalPrimitiveSubtypeSparseCheckoutImplementation]).trim()
		.split("\n").sort()
	, [...nominalPrimitiveSubtypeSparseCheckoutImplementationPaths].sort());
	assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
		, nominalPrimitiveSubtypeSparseCheckoutPredecessor
		, nominalPrimitiveSubtypeSparseCheckoutImplementation]).trim()
		.split("\n").sort()
	, [...nominalPrimitiveSubtypeSparseCheckoutModifiedPaths].sort());
});

test("primitive Subtype sparse checkout reverses every transition", async () => {
	const record = await readNominalPrimitiveSubtypeSparseCheckout();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeNominalPrimitiveSubtypeSparseCheckoutSource);
		const base = record.integrationUpdates.includes(update)
			? nominalPrimitiveSubtypeSparseCheckoutImplementation
			: nominalPrimitiveSubtypeSparseCheckoutPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseNominalPrimitiveSubtypeSparseCheckoutUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of [
		...record.implementationAdditions, ...record.additions
	]) assert.equal(sha256(await sourceAtFinHistoryMilestone(
		addition.path, addition.currentSha256))
	, addition.currentSha256, addition.path);
});

test("primitive Subtype acceptance uses one exact bounded history checkout", () => {
	for(const path of nominalPrimitiveSubtypeSparseCheckoutWorkflowPaths)
	{
		const workflow = git(["show"
			, `${nominalPrimitiveSubtypeSparseCheckoutImplementation}:${path}`]);
		const checkout = workflow.split(
			"      - name: Check out the exact revision and original evidence history\n"
		)[1].split("      - name: ")[0];
		assertNominalPrimitiveSubtypeHistoryCheckout(checkout);
	}
	const helper = git(["show"
		, `${nominalPrimitiveSubtypeSparseCheckoutImplementation}:`
			+ "tests/helpers/nominal-primitive-subtype-history-checkout.mjs"]);
	assert.match(helper
		, /Retain every producer commit while materializing only live source/u);
	assert.match(helper
		, /nominal-primitive-subtype-python-20261014/u);
	assert.match(helper
		, /nominal-primitive-subtype-npm-20261014/u);
});

test("primitive Subtype sparse checkout rejects alteration", async () => {
	const update
		= (await readNominalPrimitiveSubtypeSparseCheckout()).updates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeNominalPrimitiveSubtypeSparseCheckoutSource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() =>
			reverseNominalPrimitiveSubtypeSparseCheckoutUpdate(current, forged));
	assert.equal(beforeNominalPrimitiveSubtypeSparseCheckoutSource(
		update.path, current + "unknown"), current + "unknown");
});

test("primitive Subtype sparse-checkout writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-primitive-subtype-sparse-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-nominal-primitive-subtype-sparse-checkout-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Core static sparse checkout records its exact source range", async () => {
	const record = await readStaticSparseCheckout();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-static-sparse-checkout-source-v1");
	assert.equal(record.predecessorCommit, coreStaticSparseCheckoutPredecessor);
	assert.equal(record.implementationCommit, coreStaticSparseCheckoutImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreStaticSparseCheckoutImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreStaticSparseCheckoutIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreStaticSparseCheckoutAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreStaticSparseCheckoutImplementation}^`]).trim()
	, coreStaticSparseCheckoutPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, coreStaticSparseCheckoutPredecessor
		, coreStaticSparseCheckoutImplementation]).trim().split("\n")
	, [...coreStaticSparseCheckoutImplementationPaths].sort());
});

test("Core static sparse checkout reverses every transition", async () => {
	const record = await readStaticSparseCheckout();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreStaticSparseCheckoutSource);
		const base = record.integrationUpdates.includes(update)
			? coreStaticSparseCheckoutImplementation
			: coreStaticSparseCheckoutPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreStaticSparseCheckoutUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Core static sparse checkout preserves every static source root", () => {
	const workflow = git(["show"
		, `${coreStaticSparseCheckoutImplementation}:.github/workflows/quality.yml`]);
	const staticJob = workflow.slice(workflow.indexOf("\n  static:\n")
		, workflow.indexOf("\n  contract:\n"));
	const sparse = /sparse-checkout: \|\n((?: {12}\S+\n)+)/u.exec(staticJob);
	assert.ok(sparse);
	assert.deepEqual(sparse[1].trim().split("\n").map(line => line.trim()), [
		".github", "acceptance", "config", "containers", "demos", "nix"
		, "notices", "patches", "poc", "schema", "scripts", "site", "src"
		, "tests"
	]);
	assert.doesNotMatch(staticJob, /^ {12}docs$/mu);
	assert.match(staticJob, /fetch-depth: 1/u);
	assert.match(staticJob, /sparse-checkout-cone-mode: true/u);
	for(const command of ["env:check:core", "lint", "typecheck"])
		assert.match(staticJob, new RegExp(`npm run ${command}`, "u"));
	const budget = git(["show"
		, `${coreStaticSparseCheckoutImplementation}:`
			+ "tests/helpers/core-quality-budget-tests.mjs"]);
	assert.match(budget, /Static and aggregate jobs must omit archived evidence payloads/u);
});

test("Core static sparse checkout rejects alteration", async () => {
	const update = (await readStaticSparseCheckout()).updates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256, beforeCoreStaticSparseCheckoutSource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreStaticSparseCheckoutUpdate(current, forged));
	assert.equal(beforeCoreStaticSparseCheckoutSource(
		update.path, current + "unknown"), current + "unknown");
});

test("Core static sparse-checkout writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-core-static-sparse-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-static-sparse-checkout-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Core static-history deferral records its exact source range", async () => {
	const record = await readStaticHistoryDeferral();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-static-history-deferral-source-v1");
	assert.equal(record.predecessorCommit, coreStaticHistoryDeferralPredecessor);
	assert.equal(record.implementationCommit, coreStaticHistoryDeferralImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreStaticHistoryDeferralImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreStaticHistoryDeferralIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreStaticHistoryDeferralAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreStaticHistoryDeferralImplementation}^`]).trim()
	, coreStaticHistoryDeferralPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, coreStaticHistoryDeferralPredecessor
		, coreStaticHistoryDeferralImplementation]).trim().split("\n")
	, [...coreStaticHistoryDeferralImplementationPaths].sort());
});

test("Core static-history deferral reverses every transition", async () => {
	const record = await readStaticHistoryDeferral();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreStaticHistoryDeferralSource);
		const base = record.integrationUpdates.includes(update)
			? coreStaticHistoryDeferralImplementation
			: coreStaticHistoryDeferralPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreStaticHistoryDeferralUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Core static-history deferral preserves the closed contract", () => {
	const workflow = git(["show"
		, `${coreStaticHistoryDeferralImplementation}:.github/workflows/quality.yml`]);
	const staticJob = workflow.slice(workflow.indexOf("\n  static:\n")
		, workflow.indexOf("\n  contract:\n"));
	const contractJob = workflow.slice(workflow.indexOf("\n  contract:\n")
		, workflow.indexOf("\n  quality:\n"));
	assert.match(staticJob, /fetch-depth: 1/u);
	assert.doesNotMatch(staticJob, /fetch-depth: 0/u);
	assert.match(contractJob, /needs: static/u);
	assert.match(contractJob, /fetch-depth: 0/u);
	assert.match(contractJob
		, /shard: \[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12\]/u);
	assert.match(contractJob, /max-parallel: 6/u);
	const budget = git(["show"
		, `${coreStaticHistoryDeferralImplementation}:`
			+ "tests/helpers/core-quality-budget-tests.mjs"]);
	assert.match(budget, /History-heavy contract shards must wait for the static gate/u);
	assert.match(budget, /Only contract shards may retain all producer history/u);
});

test("Core static-history deferral rejects alteration", async () => {
	const update = (await readStaticHistoryDeferral()).updates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256, beforeCoreStaticHistoryDeferralSource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreStaticHistoryDeferralUpdate(current, forged));
	assert.equal(beforeCoreStaticHistoryDeferralSource(
		update.path, current + "unknown"), current + "unknown");
});

test("Core static-history deferral writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-core-static-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-static-history-deferral-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Core owned-reviewed exact-stop repair records its range", async () => {
	const record = await readOwnedReviewedExactStopRepair();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-owned-reviewed-exact-stop-repair-source-v1");
	assert.equal(record.predecessorCommit
		, coreOwnedReviewedExactStopRepairPredecessor);
	assert.equal(record.implementationCommit
		, coreOwnedReviewedExactStopRepairImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreOwnedReviewedExactStopRepairImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreOwnedReviewedExactStopRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreOwnedReviewedExactStopRepairAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreOwnedReviewedExactStopRepairImplementation}^`]).trim()
	, coreOwnedReviewedExactStopRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, coreOwnedReviewedExactStopRepairPredecessor
		, coreOwnedReviewedExactStopRepairImplementation]).trim().split("\n")
	, [...coreOwnedReviewedExactStopRepairImplementationPaths].sort());
});

test("Core owned-reviewed exact-stop reverses every transition", async () => {
	const record = await readOwnedReviewedExactStopRepair();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreOwnedReviewedExactStopRepairSource);
		const base = record.integrationUpdates.includes(update)
			? coreOwnedReviewedExactStopRepairImplementation
			: coreOwnedReviewedExactStopRepairPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreOwnedReviewedExactStopRepairUpdate(
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

test("Core owned-reviewed exact-stop selects requested endpoints", () => {
	const source = git(["show"
		, `${coreOwnedReviewedExactStopRepairImplementation}:`
			+ "tests/owned-reviewed-evidence.test.mjs"]);
	assert.match(source
		, /beforeOwnedPackage\(update\.path, live, update\.currentSha256\)/u);
	assert.match(source
		, /beforeOwnedReviewed\(update\.path, live, update\.previousSha256\)/u);
});

test("Core owned-reviewed exact-stop rejects alteration", async () => {
	const update = (await readOwnedReviewedExactStopRepair()).updates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCoreOwnedReviewedExactStopRepairSource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreOwnedReviewedExactStopRepairUpdate(
			current, forged));
	assert.equal(beforeCoreOwnedReviewedExactStopRepairSource(
		update.path, current + "unknown"), current + "unknown");
});

test("Core owned-reviewed exact-stop writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-owned-reviewed-exact-stop-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-owned-reviewed-exact-stop-repair-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Core WIT exact-stop repair records its exact source range", async () => {
	const record = await readWitExactStopRepair();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-wit-exact-stop-repair-source-v1");
	assert.equal(record.predecessorCommit
		, coreWitExactStopRepairPredecessor);
	assert.equal(record.implementationCommit
		, coreWitExactStopRepairImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreWitExactStopRepairImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreWitExactStopRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreWitExactStopRepairAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreWitExactStopRepairImplementation}^`]).trim()
	, coreWitExactStopRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, coreWitExactStopRepairPredecessor
		, coreWitExactStopRepairImplementation]).trim().split("\n")
	, [...coreWitExactStopRepairImplementationPaths].sort());
});

test("Core WIT exact-stop repair reverses every source transition", async () => {
	const record = await readWitExactStopRepair();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreWitExactStopRepairSource);
		const base = record.integrationUpdates.includes(update)
			? coreWitExactStopRepairImplementation
			: coreWitExactStopRepairPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreWitExactStopRepairUpdate(
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

test("Core WIT exact-stop repair selects requested endpoints", () => {
	for(const path of coreWitExactStopRepairImplementationPaths)
	{
		const source = git(["show"
			, `${coreWitExactStopRepairImplementation}:${path}`]);
		assert.match(source, /update\.currentSha256/u, path);
		assert.match(source, /update\.previousSha256/u, path);
		assert.match(source, /await readFile\(file\.path\), target/u, path);
	}
});

test("Core WIT exact-stop repair rejects alteration", async () => {
	const update = (await readWitExactStopRepair()).updates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCoreWitExactStopRepairSource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreWitExactStopRepairUpdate(
			current, forged));
	assert.equal(beforeCoreWitExactStopRepairSource(
		update.path, current + "unknown"), current + "unknown");
});

test("Core WIT exact-stop writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-core-wit-exact-stop-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-wit-exact-stop-repair-source-history.mjs"
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
