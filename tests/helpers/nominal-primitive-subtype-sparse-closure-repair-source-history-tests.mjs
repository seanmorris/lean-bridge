/**
 * Authenticate the complete primitive-base sparse-history closure repair.
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
	beforeNominalPrimitiveSubtypeSparseClosureRepairSource
	, nominalPrimitiveSubtypeSparseClosureRepairAddedPaths
	, nominalPrimitiveSubtypeSparseClosureRepairEvidencePaths
	, nominalPrimitiveSubtypeSparseClosureRepairHistoryPath
	, nominalPrimitiveSubtypeSparseClosureRepairImplementation
	, nominalPrimitiveSubtypeSparseClosureRepairImplementationPaths
	, nominalPrimitiveSubtypeSparseClosureRepairIntegrationPaths
	, nominalPrimitiveSubtypeSparseClosureRepairNormalizationPaths
	, nominalPrimitiveSubtypeSparseClosureRepairPinPaths
	, nominalPrimitiveSubtypeSparseClosureRepairPinRepair
	, nominalPrimitiveSubtypeSparseClosureRepairPredecessor
	, nominalPrimitiveSubtypeSparseClosureRepairWorkflowPaths
	, reverseNominalPrimitiveSubtypeSparseClosureRepairUpdate
} from "./nominal-primitive-subtype-sparse-closure-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const record = async () => JSON.parse(await readFile(
	nominalPrimitiveSubtypeSparseClosureRepairHistoryPath, "utf8"));

test("nominal sparse closure records both hosted pre-semantic failures", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "nominal-primitive-subtype-sparse-closure-repair-v1");
	assert.equal(history.predecessorCommit
		, nominalPrimitiveSubtypeSparseClosureRepairPredecessor);
	assert.equal(history.implementationCommit
		, nominalPrimitiveSubtypeSparseClosureRepairImplementation);
	assert.equal(history.pinRepairCommit
		, nominalPrimitiveSubtypeSparseClosureRepairPinRepair);
	assert.deepEqual(history.failedRuns, [
		{ workflow: 43268892037, job: 131359793444, lane: "browser" }
		, { workflow: 43268982805, job: 131360105292, lane: "npm" }
	]);
	assert.equal(history.failedHead
		, nominalPrimitiveSubtypeSparseClosureRepairPredecessor);
	assert.equal(history.failureClass, "deterministic sparse-checkout ENOENT");
	assert.equal(history.firstMissingPath
		, "docs/evidence/optional-parameter-dispatch-bridge-source-history-20261029.json");
	assert.deepEqual(names(["diff", "--name-only"
		, nominalPrimitiveSubtypeSparseClosureRepairPredecessor
		, nominalPrimitiveSubtypeSparseClosureRepairImplementation])
	, [...nominalPrimitiveSubtypeSparseClosureRepairImplementationPaths].sort());
	assert.deepEqual(names(["diff", "--name-only"
		, nominalPrimitiveSubtypeSparseClosureRepairImplementation
		, nominalPrimitiveSubtypeSparseClosureRepairPinRepair])
	, nominalPrimitiveSubtypeSparseClosureRepairPinPaths);
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, nominalPrimitiveSubtypeSparseClosureRepairIntegrationPaths);
});

test("nominal sparse closure covers every workflow and eager history record"
	, async () => {
		const history = await record();
		assert.deepEqual(history.evidencePaths
			, nominalPrimitiveSubtypeSparseClosureRepairEvidencePaths);
		assert.equal(history.evidencePaths.length, 20);
		assert.deepEqual(history.updates.map(update => update.path)
			, nominalPrimitiveSubtypeSparseClosureRepairImplementationPaths);
		const helper = git(["show"
			, nominalPrimitiveSubtypeSparseClosureRepairImplementation
				+ ":tests/helpers/nominal-primitive-subtype-history-checkout.mjs"]);
		const historical = await import("data:text/javascript;base64,"
			+ Buffer.from(helper).toString("base64"));
		assert.deepEqual(historical.nominalPrimitiveSubtypeHistoryEvidencePaths
			, nominalPrimitiveSubtypeSparseClosureRepairEvidencePaths);
		for(const path of nominalPrimitiveSubtypeSparseClosureRepairWorkflowPaths)
		{
			const workflow = git(["show"
				, nominalPrimitiveSubtypeSparseClosureRepairImplementation + ":" + path]);
			const checkout = workflow.split(
				"      - name: Check out the exact revision and original evidence history\n"
			)[1].split("      - name: ")[0];
			historical.assertNominalPrimitiveSubtypeHistoryCheckout(checkout);
			for(const evidence of history.evidencePaths)
				assert.ok(checkout.includes(`            /${evidence}\n`)
					, `${path}: ${evidence}`);
		}
		assert.deepEqual(history.sparseProbe, {
			materializedBytes: 473634035, filteredTests: 3, passed: 3
		});
	}
);

test("nominal sparse closure advances exactly 48 live workflow pins", async () => {
	const history = await record();
	assert.equal(history.currentSourcePins.length, 12);
	assert.equal(history.currentSourcePins.reduce(
		(sum, pin) => sum + pin.count, 0), 48);
	const before = git(["show"
		, nominalPrimitiveSubtypeSparseClosureRepairImplementation
			+ ":docs/type-surface.v1.json"]);
	const after = git(["show"
		, nominalPrimitiveSubtypeSparseClosureRepairPinRepair
			+ ":docs/type-surface.v1.json"]);
	let restored = after;
	for(const pin of history.currentSourcePins)
	{
		assert.equal(after.split(pin.current).length - 1, pin.count, pin.path);
		assert.equal(after.includes(pin.previous), false, pin.path);
		restored = restored.replaceAll(pin.current, pin.previous);
	}
	assert.equal(restored, before);
});

test("nominal sparse closure reverses every authenticated source", async () => {
	const history = await record();
	for(const [updates, current, previous] of [
		[history.updates, nominalPrimitiveSubtypeSparseClosureRepairImplementation
			, nominalPrimitiveSubtypeSparseClosureRepairPredecessor]
		, [history.pinUpdates, nominalPrimitiveSubtypeSparseClosureRepairPinRepair
			, nominalPrimitiveSubtypeSparseClosureRepairImplementation]
	]) for(const update of updates)
		assert.equal(reverseNominalPrimitiveSubtypeSparseClosureRepairUpdate(
			git(["show", current + ":" + update.path]), update)
			, git(["show", previous + ":" + update.path]), update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, nominalPrimitiveSubtypeSparseClosureRepairPinRepair
				+ ":" + update.path]);
		assert.equal(reverseNominalPrimitiveSubtypeSparseClosureRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeNominalPrimitiveSubtypeSparseClosureRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of nominalPrimitiveSubtypeSparseClosureRepairNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("nominal sparse closure rejects forged history and duplicate writers"
	, async t => {
		const history = await record();
		assert.deepEqual(history.additions.map(addition => addition.path)
			, nominalPrimitiveSubtypeSparseClosureRepairAddedPaths);
		for(const addition of history.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, nominalPrimitiveSubtypeSparseClosureRepairImplementation
				+ ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.yml" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseNominalPrimitiveSubtypeSparseClosureRepairUpdate(current, forged));
		const root = await mkdtemp(join(tmpdir(), "nominal-sparse-closure-guard-"));
		t.after(() => rm(root, { recursive: true }));
		const duplicate = spawnSync(process.execPath, [resolve(
			"scripts/update-nominal-primitive-subtype-sparse-closure-repair-source-history.mjs"
		)], { cwd: root, encoding: "utf8", timeout: 15_000 });
		assert.notEqual(duplicate.status, 0);
		assert.equal(duplicate.stdout, "");
		assert.deepEqual(await readdir(root), []);
	}
);
