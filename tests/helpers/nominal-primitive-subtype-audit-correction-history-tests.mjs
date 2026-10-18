/**
 * Authenticate the exact #1499 primitive-base audit correction transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	beforeNominalPrimitiveSubtypeAuditCorrectionPins
	, beforeNominalPrimitiveSubtypeAuditCorrectionSource
	, nominalPrimitiveSubtypeAuditCorrectionChangedPaths
	, nominalPrimitiveSubtypeAuditCorrectionDraftParent
	, nominalPrimitiveSubtypeAuditCorrectionHistoryPath
	, nominalPrimitiveSubtypeAuditCorrectionPredecessor
	, reverseNominalPrimitiveSubtypeAuditCorrectionUpdate
} from "./nominal-primitive-subtype-audit-correction-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const original = path => execFileSync("git", ["show", `${nominalPrimitiveSubtypeAuditCorrectionPredecessor}:${path}`]
	, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

test("primitive-base audit correction history authenticates every source transition", async t => {
	const record = JSON.parse(await readFile(nominalPrimitiveSubtypeAuditCorrectionHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "nominal-primitive-subtype-audit-correction-source-v1");
	assert.equal(record.predecessorCommit, nominalPrimitiveSubtypeAuditCorrectionPredecessor);
	assert.equal(record.draftParentCommit, nominalPrimitiveSubtypeAuditCorrectionDraftParent);
	assert.deepEqual(record.updates.map(update => update.path), nominalPrimitiveSubtypeAuditCorrectionChangedPaths);
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const previous = reverseNominalPrimitiveSubtypeAuditCorrectionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalPrimitiveSubtypeAuditCorrectionSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalPrimitiveSubtypeAuditCorrectionSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNominalPrimitiveSubtypeAuditCorrectionSource(update.path, current + "unknown")
			, current + "unknown");
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalPrimitiveSubtypeAuditCorrectionUpdate(current, changed));
		}
	}
	// The correction adds no receipts or cells; reversing its pins restores the predecessor inventory.
	const update = record.updates.find(item => item.path === inventoryPath);
	const current = JSON.parse(beforeFinRefinementSource(inventoryPath, await readFile(inventoryPath, "utf8"), update.currentSha256));
	const baseline = JSON.parse(original(inventoryPath));
	assert.deepEqual(beforeNominalPrimitiveSubtypeAuditCorrectionPins(current), baseline);
	assert.deepEqual(current.observations, baseline.observations);
	assert.deepEqual(current.evidence.map(entry => entry.id), baseline.evidence.map(entry => entry.id));
	const pins = current.evidence.flatMap(entry => entry.files)
		.filter((file, index) => file.sha256 !== baseline.evidence.flatMap(entry => entry.files)[index].sha256);
	assert.ok(pins.length > 0 && pins.every(file => nominalPrimitiveSubtypeAuditCorrectionChangedPaths.includes(file.path)));
	t.diagnostic(`${pins.length} corrected-source pins refreshed; no receipts or cells changed`);
});

test("primitive-base audit correction history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-audit-correction-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	const identity = ["-c", "user.name=Test", "-c", "user.email=test@example.invalid"];
	git([...identity, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const script = resolve("scripts/update-nominal-primitive-subtype-audit-correction-history.mjs");
	const result = spawnSync(process.execPath, [script], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
