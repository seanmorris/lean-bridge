/**
 * Authenticate the Core source boundary closure history layer.
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
	beforeCoreSourceBoundaryClosureSource
	, coreSourceBoundaryClosureAddedPaths
	, coreSourceBoundaryClosureHistoryPath
	, coreSourceBoundaryClosureImplementation
	, coreSourceBoundaryClosureImplementationAdditions
	, coreSourceBoundaryClosureImplementationPaths
	, coreSourceBoundaryClosureIntegrationPaths
	, coreSourceBoundaryClosureModifiedPaths
	, coreSourceBoundaryClosurePredecessor
	, reverseCoreSourceBoundaryClosureUpdate
} from "./core-source-boundary-closure-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const gitBytes = arguments_ => execFileSync("git", arguments_, {
	maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	coreSourceBoundaryClosureHistoryPath, "utf8"));
// This layer always reverses a recognized transition, so milestones resolve
// through the central hub alone, which owns every stop decision.
const atMilestone = (path, digest) => sourceAtFinHistoryMilestone(path, digest);
void inventoryPath;

test("Core source boundary closure history restores every source"
	, async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-source-boundary-closure-source-v1");
	assert.equal(record.predecessorCommit, coreSourceBoundaryClosurePredecessor);
	assert.equal(record.implementationCommit, coreSourceBoundaryClosureImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, coreSourceBoundaryClosureModifiedPaths);
	assert.deepEqual(record.implementationAdditions.map(item => item.path)
		, coreSourceBoundaryClosureImplementationAdditions);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, coreSourceBoundaryClosureIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, coreSourceBoundaryClosureAddedPaths);
	for(const update of record.updates)
	{
		const current = await atMilestone(update.path, update.currentSha256);
		const previous = git(["show"
			, `${coreSourceBoundaryClosurePredecessor}:${update.path}`]);
		assert.equal(current, git(["show"
			, `${coreSourceBoundaryClosureImplementation}:${update.path}`]), update.path);
		assert.equal(reverseCoreSourceBoundaryClosureUpdate(current, update), previous
			, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await atMilestone(update.path, update.currentSha256);
		const previous = git(["show"
			, `${coreSourceBoundaryClosureImplementation}:${update.path}`]);
		assert.equal(reverseCoreSourceBoundaryClosureUpdate(current, update), previous
			, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
	}
);

test("Core source boundary closure history is one exact commit", async () => {
	const predecessor = coreSourceBoundaryClosurePredecessor;
	const implementation = coreSourceBoundaryClosureImplementation;
	const modified = [...coreSourceBoundaryClosureModifiedPaths].sort();
	assert.equal(git(["rev-parse", `${implementation}^`]).trim()
		, predecessor);
	assert.deepEqual(names(["diff", "--name-only", predecessor
		, implementation]), [...coreSourceBoundaryClosureImplementationPaths].sort());
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, predecessor, implementation]), modified);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
		, predecessor, implementation])
	, [...coreSourceBoundaryClosureImplementationAdditions].sort());
	const { implementationAdditions } = await readRecord();
	for(const addition of implementationAdditions)
		assert.equal(sha256(gitBytes(["show"
			, `${implementation}:${addition.path}`]))
		, addition.currentSha256, addition.path);
});

test("Core source boundary closure history refreshes exactly the closed live pins"
	, async () => {
	const record = await readRecord();
	const inventoryUpdate = record.integrationUpdates.find(item =>
		item.path === inventoryPath);
	// Read this layer's own inventory milestone, never the live inventory that
	// later pin layers keep changing.
	const inventory = JSON.parse(await atMilestone(
		inventoryPath, inventoryUpdate.currentSha256));
	const before = JSON.parse(git(["show"
		, `${coreSourceBoundaryClosureImplementation}:${inventoryPath}`]));
	const expected = new Map([
		...record.updates.map(item => [item.path, item.currentSha256])
		, ...record.integrationUpdates.filter(item => item.path !== inventoryPath)
			.map(item => [item.path, item.currentSha256])
	]);
	assert.equal(inventory.evidence.length, before.evidence.length);
	let refreshed = 0;
	for(const [index, evidence] of inventory.evidence.entries())
	{
		const previous = before.evidence[index];
		assert.equal(evidence.files.length, previous.files.length);
		for(const [position, file] of evidence.files.entries())
		{
			const old = previous.files[position];
			assert.equal(file.path, old.path);
			if(expected.has(file.path))
			{
				assert.ok(!file.path.startsWith("docs/evidence/"), file.path);
				assert.equal(file.sha256, expected.get(file.path), file.path);
				if(old.sha256 !== file.sha256) refreshed++;
			}
			else assert.equal(file.sha256, old.sha256, file.path);
		}
	}
	assert.ok(refreshed > 0);
	assert.equal(beforeFinRefinementSource(inventoryPath
		, JSON.stringify(inventory, null, 2) + "\n"
		, inventoryUpdate.previousSha256)
	, git(["show", `${coreSourceBoundaryClosureImplementation}:${inventoryPath}`]));
	}
);

test("Core source boundary closure layer lets the hub reach older milestones"
	, async () => {
	const record = await readRecord();
	const update = [...record.updates, ...record.integrationUpdates].find(item =>
		item.path === "tests/helpers/fin-refinement-source-history.mjs");
	const current = await atMilestone(update.path, update.currentSha256);
	const older = "bea28eba41d4caf7a27d65a2b50d1fd3ede5115e";
	const target = git(["show", `${older}:${update.path}`]);
	assert.notEqual(sha256(target), update.previousSha256);
	assert.equal(beforeFinRefinementSource(update.path, current, sha256(target))
		, target);
	}
);

test("Core source boundary closure history rejects alteration", async () => {
	const record = await readRecord();
	const update = structuredClone(record.updates[0]);
	const current = await atMilestone(update.path, update.currentSha256);
	const forged = structuredClone(update);
	forged.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseCoreSourceBoundaryClosureUpdate(current, forged));
	const shifted = structuredClone(update);
	shifted.edits[0].start += 1;
	assert.throws(() => reverseCoreSourceBoundaryClosureUpdate(current, shifted));
	const rewritten = structuredClone(update);
	rewritten.edits[0].previous += "x";
	assert.throws(() => reverseCoreSourceBoundaryClosureUpdate(current, rewritten));
	assert.equal(beforeCoreSourceBoundaryClosureSource(update.path, current, update.currentSha256)
		, reverseCoreSourceBoundaryClosureUpdate(current, update)
		, "a recognized transition is reversed regardless of the stop digest");
	assert.equal(beforeCoreSourceBoundaryClosureSource(update.path, `${current}unrelated\n`)
		, `${current}unrelated\n`);
	assert.equal(beforeCoreSourceBoundaryClosureSource("docs/unrelated.md", current), current);
});

test("Core source boundary closure history writer refuses another checkout"
	, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-core-source-boundary-closure-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-source-boundary-closure-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
