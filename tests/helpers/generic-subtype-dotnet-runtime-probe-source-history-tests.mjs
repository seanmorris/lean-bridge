/**
 * Authenticate the generic Subtype .NET runtime probe history layer.
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
	beforeGenericSubtypeDotnetRuntimeProbeSource
	, genericSubtypeDotnetRuntimeProbeAddedPaths
	, genericSubtypeDotnetRuntimeProbeApplied
	, genericSubtypeDotnetRuntimeProbeHistoryPath
	, genericSubtypeDotnetRuntimeProbeImplementation
	, genericSubtypeDotnetRuntimeProbeIntegrationBase
	, genericSubtypeDotnetRuntimeProbeIntegrationPaths
	, genericSubtypeDotnetRuntimeProbeModifiedPaths
	, genericSubtypeDotnetRuntimeProbePredecessor
	, reverseGenericSubtypeDotnetRuntimeProbeUpdate
} from "./generic-subtype-dotnet-runtime-probe-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	genericSubtypeDotnetRuntimeProbeHistoryPath, "utf8"));
// This layer always reverses a recognized transition, so milestones resolve
// through the central hub alone, which owns every stop decision.
const atMilestone = (path, digest) => sourceAtFinHistoryMilestone(path, digest);
void inventoryPath;

test("generic Subtype .NET runtime probe history restores every source"
	, async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "generic-subtype-dotnet-runtime-probe-source-v1");
	assert.equal(record.predecessorCommit, genericSubtypeDotnetRuntimeProbePredecessor);
	assert.equal(record.implementationCommit, genericSubtypeDotnetRuntimeProbeImplementation);
	assert.equal(record.integrationBaseCommit
		, genericSubtypeDotnetRuntimeProbeIntegrationBase);
	assert.equal(record.appliedCommit, genericSubtypeDotnetRuntimeProbeApplied);
	assert.deepEqual(record.updates.map(item => item.path)
		, genericSubtypeDotnetRuntimeProbeModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, genericSubtypeDotnetRuntimeProbeIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, genericSubtypeDotnetRuntimeProbeAddedPaths);
	for(const update of record.updates)
	{
		const current = await atMilestone(update.path, update.currentSha256);
		const previous = git(["show"
			, `${genericSubtypeDotnetRuntimeProbePredecessor}:${update.path}`]);
		assert.equal(current, git(["show"
			, `${genericSubtypeDotnetRuntimeProbeImplementation}:${update.path}`]), update.path);
		assert.equal(reverseGenericSubtypeDotnetRuntimeProbeUpdate(current, update), previous
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
			, `${genericSubtypeDotnetRuntimeProbeIntegrationBase}:${update.path}`]);
		assert.equal(reverseGenericSubtypeDotnetRuntimeProbeUpdate(current, update), previous
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

test("generic Subtype .NET runtime probe history is one exact commit", () => {
	const predecessor = genericSubtypeDotnetRuntimeProbePredecessor;
	const implementation = genericSubtypeDotnetRuntimeProbeImplementation;
	const modified = [...genericSubtypeDotnetRuntimeProbeModifiedPaths].sort();
	assert.equal(git(["rev-parse", `${implementation}^`]).trim()
		, predecessor);
	assert.deepEqual(names(["diff", "--name-only", predecessor
		, implementation]), modified);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, predecessor, implementation]), modified);
	assert.equal(git(["rev-parse"
		, `${genericSubtypeDotnetRuntimeProbeApplied}^`]).trim()
		, genericSubtypeDotnetRuntimeProbeIntegrationBase);
	for(const path of genericSubtypeDotnetRuntimeProbeModifiedPaths)
		assert.equal(git(["show"
			, `${genericSubtypeDotnetRuntimeProbeApplied}:${path}`])
		, git(["show", `${implementation}:${path}`]), path);
});

test("generic Subtype .NET runtime probe layer lets the hub reach older milestones"
	, async () => {
	const record = await readRecord();
	const update = [...record.updates, ...record.integrationUpdates].find(item =>
		item.path === "tests/generic-subtype-managed-wit.test.mjs");
	const current = await atMilestone(update.path, update.currentSha256);
	const older = "71076147b95eb9e2f1a613c4f04a8bf2fd7694d5";
	const target = git(["show", `${older}:${update.path}`]);
	assert.notEqual(sha256(target), update.previousSha256);
	assert.equal(beforeFinRefinementSource(update.path, current, sha256(target))
		, target);
	}
);

test("generic Subtype .NET runtime probe history rejects alteration", async () => {
	const record = await readRecord();
	const update = structuredClone(record.updates[0]);
	const current = await atMilestone(update.path, update.currentSha256);
	const forged = structuredClone(update);
	forged.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseGenericSubtypeDotnetRuntimeProbeUpdate(current, forged));
	const shifted = structuredClone(update);
	shifted.edits[0].start += 1;
	assert.throws(() => reverseGenericSubtypeDotnetRuntimeProbeUpdate(current, shifted));
	const rewritten = structuredClone(update);
	rewritten.edits[0].previous += "x";
	assert.throws(() => reverseGenericSubtypeDotnetRuntimeProbeUpdate(current, rewritten));
	assert.equal(beforeGenericSubtypeDotnetRuntimeProbeSource(update.path, current, update.currentSha256)
		, reverseGenericSubtypeDotnetRuntimeProbeUpdate(current, update)
		, "a recognized transition is reversed regardless of the stop digest");
	assert.equal(beforeGenericSubtypeDotnetRuntimeProbeSource(update.path, `${current}unrelated\n`)
		, `${current}unrelated\n`);
	assert.equal(beforeGenericSubtypeDotnetRuntimeProbeSource("docs/unrelated.md", current), current);
});

test("generic Subtype .NET runtime probe history writer refuses another checkout"
	, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-generic-subtype-dotnet-runtime-probe-history-"));
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
		"scripts/update-generic-subtype-dotnet-runtime-probe-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);

test("generic Subtype C# caller answers only the runtime probe", async () => {
	const caller = await readFile("tests/fixtures/generic-subtype-consumers/dotnet.cs", "utf8");
	assert.equal(caller.split("static int Main(string[] arguments)").length, 2);
	assert.equal(caller.split("arguments.Length == 1 && arguments[0] == \"--runtime\"").length, 2);
	assert.equal(caller.split("throw new InvalidOperationException(\"Unexpected caller arguments\")").length, 2);
	for(const key of ["version", "description", "directory", "command", "architecture", "os", "littleEndian"])
		assert.match(caller, new RegExp(`^\\s+${key} = `, "mu"), key);
	assert.doesNotMatch(caller, /static void Main\(/u);
});
