/**
 * Authenticate the generic-Subtype hosted source-closure repair.
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
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeGenericSubtypeEvidenceSourceClosureRepairSource
	, genericSubtypeEvidenceSourceClosureRepairAddedPaths
	, genericSubtypeEvidenceSourceClosureRepairHistoryPath
	, genericSubtypeEvidenceSourceClosureRepairImplementation
	, genericSubtypeEvidenceSourceClosureRepairImplementationPaths
	, genericSubtypeEvidenceSourceClosureRepairIntegrationPaths
	, genericSubtypeEvidenceSourceClosureRepairPredecessor
	, reverseGenericSubtypeEvidenceSourceClosureRepairUpdate
} from "./generic-subtype-evidence-source-closure-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

test("generic-Subtype source-closure history restores every source"
	, async () => {
		const record = JSON.parse(await readFile(
			genericSubtypeEvidenceSourceClosureRepairHistoryPath, "utf8"));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "generic-subtype-evidence-source-closure-repair-v1");
		assert.equal(record.predecessorCommit
			, genericSubtypeEvidenceSourceClosureRepairPredecessor);
		assert.equal(record.implementationCommit
			, genericSubtypeEvidenceSourceClosureRepairImplementation);
		assert.deepEqual(record.updates.map(item => item.path)
			, genericSubtypeEvidenceSourceClosureRepairImplementationPaths);
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, genericSubtypeEvidenceSourceClosureRepairIntegrationPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, genericSubtypeEvidenceSourceClosureRepairAddedPaths);
		for(const update of [...record.updates, ...record.integrationUpdates])
		{
			const current = await sourceAtFinHistoryMilestone(update.path
				, update.currentSha256
				, beforeGenericSubtypeEvidenceSourceClosureRepairSource);
			const base = record.updates.includes(update)
				? genericSubtypeEvidenceSourceClosureRepairPredecessor
				: genericSubtypeEvidenceSourceClosureRepairImplementation;
			const previous = git(["show", `${base}:${update.path}`]);
			assert.equal(reverseGenericSubtypeEvidenceSourceClosureRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous
				, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path)
				, update.path);
		}
		for(const addition of record.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
	}
);

test("generic-Subtype source-closure history range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${genericSubtypeEvidenceSourceClosureRepairImplementation}^`]).trim()
	, genericSubtypeEvidenceSourceClosureRepairPredecessor);
	assert.deepEqual(names(["diff", "--name-only"
		, genericSubtypeEvidenceSourceClosureRepairPredecessor
		, genericSubtypeEvidenceSourceClosureRepairImplementation])
	, [...genericSubtypeEvidenceSourceClosureRepairImplementationPaths].sort());
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, genericSubtypeEvidenceSourceClosureRepairPredecessor
		, genericSubtypeEvidenceSourceClosureRepairImplementation])
	, [...genericSubtypeEvidenceSourceClosureRepairImplementationPaths].sort());
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=ADRCT"
		, genericSubtypeEvidenceSourceClosureRepairPredecessor
		, genericSubtypeEvidenceSourceClosureRepairImplementation]), []);
	assert.deepEqual(names(["diff", "--name-only"
		, genericSubtypeEvidenceSourceClosureRepairImplementation, "HEAD"
		, "--", ...genericSubtypeEvidenceSourceClosureRepairImplementationPaths])
	, [], "archive commits must not alter the repaired source closure");
});

test("generic-Subtype source-closure history rejects alterations"
	, async () => {
		const record = JSON.parse(await readFile(
			genericSubtypeEvidenceSourceClosureRepairHistoryPath, "utf8"));
		const update = structuredClone(record.updates[0]);
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeGenericSubtypeEvidenceSourceClosureRepairSource);
		assert.throws(() => reverseGenericSubtypeEvidenceSourceClosureRepairUpdate(
			current, { ...update, currentSha256: "0".repeat(64) }));
		assert.throws(() => reverseGenericSubtypeEvidenceSourceClosureRepairUpdate(
			current, { ...update, path: "unknown.mjs" }));
		const shifted = structuredClone(update);
		shifted.edits[0].start += 1;
		assert.throws(() => reverseGenericSubtypeEvidenceSourceClosureRepairUpdate(
			current, shifted));
		assert.equal(beforeGenericSubtypeEvidenceSourceClosureRepairSource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
);

test("generic-Subtype source-closure writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-generic-subtype-source-closure-guard-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const environment = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("GIT_")));
		const localGit = arguments_ => execFileSync("git", arguments_, {
			cwd: root, env: environment, stdio: "pipe"
		});
		localGit(["init", "--quiet"]);
		localGit(["-c", "user.name=Test", "-c"
			, "user.email=test@example.invalid", "-c"
			, "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
			, "-m", "unrelated"]);
		const result = spawnSync(process.execPath, [resolve(
			"scripts/update-generic-subtype-evidence-source-closure-repair-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
