/**
 * Authenticate the complete documentation sparse-input closure.
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
	assertConsumerDocumentationSparseInputClosure
	, beforeConsumerDocumentationSparseInputClosureSource
	, consumerDocumentationEvidenceRoots
	, consumerDocumentationSparseInputClosureAddedPaths
	, consumerDocumentationSparseInputClosureHistoryPath
	, consumerDocumentationSparseInputClosureImplementation
	, consumerDocumentationSparseInputClosureImplementationPaths
	, consumerDocumentationSparseInputClosureIntegrationPaths
	, consumerDocumentationSparseInputClosureNormalizationPaths
	, consumerDocumentationSparseInputClosurePinPaths
	, consumerDocumentationSparseInputClosurePinRepair
	, consumerDocumentationSparseInputClosurePredecessor
	, reverseConsumerDocumentationSparseInputClosureUpdate
} from "./consumer-documentation-sparse-input-closure-source-history.mjs";
import { consumerHistoryJobs }
	from "./consumer-history-sparse-checkout-closure-source-history.mjs";
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
	consumerDocumentationSparseInputClosureHistoryPath, "utf8"));
const implementationWorkflow = () => git(["show"
	, consumerDocumentationSparseInputClosureImplementation
		+ ":.github/workflows/consumer-matrix.yml"]);

test("documentation sparse-input closure records the exact local contract gap"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "consumer-documentation-sparse-input-closure-v1");
		assert.equal(history.predecessorCommit
			, consumerDocumentationSparseInputClosurePredecessor);
		assert.equal(history.implementationCommit
			, consumerDocumentationSparseInputClosureImplementation);
		assert.equal(history.pinRepairCommit
			, consumerDocumentationSparseInputClosurePinRepair);
		assert.deepEqual(history.localFailure, {
			command: "npm run test:docs", passed: 109, failed: 5
			, headSha: consumerDocumentationSparseInputClosurePredecessor
		});
		assert.deepEqual(history.missingInputClasses
			, ["retained Lean source", "TAP transcript"
				, "execution queue", "type-surface evidence files"]);
		assert.deepEqual(names(["diff", "--name-only"
			, consumerDocumentationSparseInputClosurePredecessor
			, consumerDocumentationSparseInputClosureImplementation])
			, consumerDocumentationSparseInputClosureImplementationPaths);
		assert.deepEqual(names(["diff", "--name-only"
			, consumerDocumentationSparseInputClosureImplementation
			, consumerDocumentationSparseInputClosurePinRepair])
			, consumerDocumentationSparseInputClosurePinPaths);
		assert.deepEqual(history.updates.map(update => update.path)
			, consumerDocumentationSparseInputClosureImplementationPaths);
		assert.deepEqual(history.pinUpdates.map(update => update.path)
			, consumerDocumentationSparseInputClosurePinPaths);
		assert.deepEqual(history.integrationUpdates.map(update => update.path)
			, consumerDocumentationSparseInputClosureIntegrationPaths);
		assert.deepEqual(history.additions.map(addition => addition.path)
			, consumerDocumentationSparseInputClosureAddedPaths);
	}
);

test("documentation sparse-input closure authenticates receipt and archives"
	, async () => {
		const history = await record();
		assert.deepEqual(history.directEvidenceRoots
			, consumerDocumentationEvidenceRoots);
		const workflow = implementationWorkflow();
		assertConsumerDocumentationSparseInputClosure(workflow);
		const documentation = consumerHistoryJobs(workflow).get("documentation");
		for(const malformedBody of [
			documentation.replace("needs: type-surface-authentication\n", "")
			, documentation.replace("actions/download-artifact@v8"
				, "actions/download-artifact@v7")
			, documentation.replace(
				"LEAN_BRIDGE_TYPE_SURFACE_EVIDENCE_RECEIPT"
				, "LEAN_BRIDGE_UNBOUND_EVIDENCE_RECEIPT")
		]) assert.throws(() => assertConsumerDocumentationSparseInputClosure(
			workflow.replace(documentation, () => malformedBody)));
		for(const root of consumerDocumentationEvidenceRoots)
			assert.throws(() => assertConsumerDocumentationSparseInputClosure(
				workflow.replace(`    /docs/evidence/${root}/\n`, ""))
				, undefined, root);
	}
);

test("documentation sparse-input closure advances exactly 92 workflow pins"
	, async () => {
		const history = await record();
		assert.deepEqual(history.currentSourcePin, {
			path: ".github/workflows/consumer-matrix.yml", count: 92
			, previous:
				"3f42de7adffc19c47844f0768be3451e810e8f51ac5a6ca83cee7af3f45001c2"
			, current:
				"e030dd3d7b920fdab9ca19301946ff4261a2aa2d217e2a57551c131ed795197f"
		});
		const before = git(["show"
			, consumerDocumentationSparseInputClosureImplementation
				+ ":docs/type-surface.v1.json"]);
		const after = git(["show"
			, consumerDocumentationSparseInputClosurePinRepair
				+ ":docs/type-surface.v1.json"]);
		assert.equal(after.split(history.currentSourcePin.current).length - 1
			, 92);
		assert.equal(after.includes(history.currentSourcePin.previous), false);
		assert.equal(after.replaceAll(history.currentSourcePin.current
			, history.currentSourcePin.previous), before);
	}
);

test("documentation sparse-input closure reverses every authenticated source"
	, async () => {
		const history = await record();
		for(const [updates, current, previous] of [
			[history.updates, consumerDocumentationSparseInputClosureImplementation
				, consumerDocumentationSparseInputClosurePredecessor]
			, [history.pinUpdates, consumerDocumentationSparseInputClosurePinRepair
				, consumerDocumentationSparseInputClosureImplementation]
		]) for(const update of updates)
			assert.equal(reverseConsumerDocumentationSparseInputClosureUpdate(
				git(["show", current + ":" + update.path]), update)
					, git(["show", previous + ":" + update.path]), update.path);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, consumerDocumentationSparseInputClosurePinRepair
					+ ":" + update.path]);
			assert.equal(reverseConsumerDocumentationSparseInputClosureUpdate(
				current, update), previous, update.path);
			assert.equal(beforeConsumerDocumentationSparseInputClosureSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of consumerDocumentationSparseInputClosureNormalizationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("documentation sparse-input closure rejects forgeries and duplicate writers"
	, async t => {
		const history = await record();
		for(const addition of history.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = implementationWorkflow();
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.yml" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseConsumerDocumentationSparseInputClosureUpdate(current, forged));
		const root = await mkdtemp(join(tmpdir(), "lean-doc-sparse-guard-"));
		t.after(() => rm(root, { recursive: true }));
		const duplicate = spawnSync(process.execPath, [resolve(
			"scripts/update-consumer-documentation-sparse-input-closure-source-history.mjs"
		)], { cwd: root, encoding: "utf8", timeout: 15_000 });
		assert.notEqual(duplicate.status, 0);
		assert.equal(duplicate.stdout, "");
		assert.deepEqual(await readdir(root), []);
	}
);
