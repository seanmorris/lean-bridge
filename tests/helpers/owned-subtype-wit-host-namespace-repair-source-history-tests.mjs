/**
 * Authenticate the owned-Subtype WIT consumer namespace repair.
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
	beforeOwnedSubtypeWitHostNamespaceRepairSource
	, ownedSubtypeWitHostNamespaceRepairAddedPaths
	, ownedSubtypeWitHostNamespaceRepairHistoryPath
	, ownedSubtypeWitHostNamespaceRepairImplementation
	, ownedSubtypeWitHostNamespaceRepairImplementationPaths
	, ownedSubtypeWitHostNamespaceRepairIntegrationPaths
	, ownedSubtypeWitHostNamespaceRepairPredecessor
	, reverseOwnedSubtypeWitHostNamespaceRepairUpdate
} from "./owned-subtype-wit-host-namespace-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

test("owned-Subtype WIT host namespace history restores every source"
	, async () => {
		const record = JSON.parse(await readFile(
			ownedSubtypeWitHostNamespaceRepairHistoryPath, "utf8"));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "owned-subtype-wit-host-namespace-repair-v1");
		assert.equal(record.predecessorCommit
			, ownedSubtypeWitHostNamespaceRepairPredecessor);
		assert.equal(record.implementationCommit
			, ownedSubtypeWitHostNamespaceRepairImplementation);
		assert.deepEqual(record.updates.map(item => item.path)
			, ownedSubtypeWitHostNamespaceRepairImplementationPaths);
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, ownedSubtypeWitHostNamespaceRepairIntegrationPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, ownedSubtypeWitHostNamespaceRepairAddedPaths);
		for(const update of [...record.updates, ...record.integrationUpdates])
		{
			const current = await sourceAtFinHistoryMilestone(update.path
				, update.currentSha256
				, beforeOwnedSubtypeWitHostNamespaceRepairSource);
			const base = record.updates.includes(update)
				? ownedSubtypeWitHostNamespaceRepairPredecessor
				: ownedSubtypeWitHostNamespaceRepairImplementation;
			const previous = git(["show", `${base}:${update.path}`]);
			assert.equal(reverseOwnedSubtypeWitHostNamespaceRepairUpdate(
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

test("owned-Subtype WIT host namespace history range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${ownedSubtypeWitHostNamespaceRepairImplementation}^`]).trim()
	, ownedSubtypeWitHostNamespaceRepairPredecessor);
	assert.deepEqual(names(["diff", "--name-only"
		, ownedSubtypeWitHostNamespaceRepairPredecessor
		, ownedSubtypeWitHostNamespaceRepairImplementation])
	, [...ownedSubtypeWitHostNamespaceRepairImplementationPaths].sort());
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, ownedSubtypeWitHostNamespaceRepairPredecessor
		, ownedSubtypeWitHostNamespaceRepairImplementation])
	, [...ownedSubtypeWitHostNamespaceRepairImplementationPaths].sort());
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=ADRCT"
		, ownedSubtypeWitHostNamespaceRepairPredecessor
		, ownedSubtypeWitHostNamespaceRepairImplementation]), []);
});

test("owned-Subtype WIT host namespace history rejects alterations"
	, async () => {
		const record = JSON.parse(await readFile(
			ownedSubtypeWitHostNamespaceRepairHistoryPath, "utf8"));
		const update = structuredClone(record.updates[0]);
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeOwnedSubtypeWitHostNamespaceRepairSource);
		assert.throws(() => reverseOwnedSubtypeWitHostNamespaceRepairUpdate(
			current, { ...update, currentSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedSubtypeWitHostNamespaceRepairUpdate(
			current, { ...update, path: "unknown.mjs" }));
		const shifted = structuredClone(update);
		shifted.edits[0].start += 1;
		assert.throws(() => reverseOwnedSubtypeWitHostNamespaceRepairUpdate(
			current, shifted));
		assert.equal(beforeOwnedSubtypeWitHostNamespaceRepairSource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
);

test("owned-Subtype WIT host namespace writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-owned-subtype-wit-namespace-guard-"));
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
			"scripts/update-owned-subtype-wit-host-namespace-repair-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
