/**
 * Authenticate the Core memory bound on the owned integration and inherited
 * promotion verifiers: the narrow contracts reader and the exact receipt-hash
 * links that replace in-process predecessor re-execution.
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
	beforeCoreMemoryBoundSource
	, coreMemoryBoundAddedPaths
	, coreMemoryBoundChangedPaths
	, coreMemoryBoundCommits
	, coreMemoryBoundHistoryPath
	, coreMemoryBoundImplementation
	, coreMemoryBoundImplementationAddedPaths
	, coreMemoryBoundPredecessor
	, reverseCoreMemoryBoundUpdate
} from "./core-memory-bound-source-history.mjs";
import { assertOwnedDotnetIntegration } from "./owned-dotnet-evidence.mjs";
import { ownedDotnetHistoryPath } from "./owned-dotnet-source-history.mjs";
import { assertOwnedPythonIntegration } from "./owned-python-evidence.mjs";
import { ownedPythonHistoryPath } from "./owned-python-source-history.mjs";
import { assertOwnedRubyIntegration } from "./owned-ruby-evidence.mjs";
import { ownedRubyHistoryPath } from "./owned-ruby-source-history.mjs";
import { ownedRustHistoryPath } from "./owned-rust-source-history.mjs";
import { readTypeSurfaceContracts } from "./type-surface-contracts.mjs";
import { typeSurfaceEvidenceSourcePaths } from "../../src/adoption/type-surface-evidence-receipt.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	coreMemoryBoundHistoryPath, "utf8"
));
const json = async path => JSON.parse(await readFile(path, "utf8"));

test("Core memory bound records exactly its implementation transitions", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions"
		, "implementationCommit", "implementationCommits", "milestone"
		, "predecessorCommit"
		, "schemaVersion", "scope", "updates"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-memory-bound-source-v1");
	assert.equal(record.predecessorCommit, coreMemoryBoundPredecessor);
	assert.equal(record.implementationCommit
		, coreMemoryBoundImplementation);
	assert.deepEqual(record.implementationCommits, coreMemoryBoundCommits);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${coreMemoryBoundPredecessor}..${coreMemoryBoundImplementation}`])
		.trim().split("\n"), coreMemoryBoundCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, coreMemoryBoundPredecessor
		, coreMemoryBoundImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...coreMemoryBoundChangedPaths
		, ...coreMemoryBoundImplementationAddedPaths].sort());
	assert.deepEqual(record.updates.map(item => item.path)
		, coreMemoryBoundChangedPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${coreMemoryBoundPredecessor}:${update.path}`]);
		const current = git(["show"
			, `${coreMemoryBoundImplementation}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseCoreMemoryBoundUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeCoreMemoryBoundSource(update.path, current)
			, previous, update.path);
		assert.equal(beforeCoreMemoryBoundSource(
			update.path, current, update.currentSha256), current, update.path);
	}
});

test("Core memory bound additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, coreMemoryBoundAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
});

test("Core memory bound rejects altered transitions and unknown content", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${coreMemoryBoundImplementation}:${update.path}`]);
		for(const changed of [{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseCoreMemoryBoundUpdate(current, changed));
		const shifted = structuredClone(update);
		shifted.edits[0].start += 1;
		assert.throws(() => reverseCoreMemoryBoundUpdate(current, shifted));
		const unknown = `${current}unrelated\n`;
		assert.equal(beforeCoreMemoryBoundSource(update.path, unknown), unknown);
		assert.throws(() => reverseCoreMemoryBoundUpdate(unknown, update));
		assert.equal(beforeCoreMemoryBoundSource("docs/unrelated.md", current)
			, current);
	}
});

test("type-surface contracts reader parses exactly the IR schema and consumer contracts", async () => {
	const [inventory, irSchemaPath, consumersPath] = typeSurfaceEvidenceSourcePaths;
	assert.equal(inventory, "docs/type-surface.v1.json");
	assert.deepEqual(await readTypeSurfaceContracts(), {
		irSchema: await json(irSchemaPath), consumers: await json(consumersPath)
	});
});

test("owned integrations pin each predecessor by exact receipt hash", async () => {
	const links = [
		[ownedDotnetHistoryPath, ownedRubyHistoryPath, assertOwnedDotnetIntegration]
		, [ownedRubyHistoryPath, ownedPythonHistoryPath, assertOwnedRubyIntegration]
		, [ownedPythonHistoryPath, ownedRustHistoryPath, assertOwnedPythonIntegration]
	];
	for(const [path, previousPath, verify] of links)
	{
		const record = await json(path);
		assert.equal(record.previous.path, previousPath, path);
		assert.equal(sha256(await readFile(previousPath)), record.previous.sha256, path);
		for(const previous of [{ ...record.previous, sha256: "0".repeat(64) }
			, { ...record.previous, path: ownedDotnetHistoryPath }])
			await assert.rejects(verify({ ...record, previous })
				, error => error instanceof assert.AssertionError
					&& [error.expected, error.actual].includes(previous.sha256 === "0".repeat(64)
						? previous.sha256 : ownedDotnetHistoryPath), path);
	}
});

test("Core memory bound writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-core-memory-bound-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-memory-bound-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
