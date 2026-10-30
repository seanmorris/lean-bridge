/**
 * Authenticate every dependent-signature implementation and integration state.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeDependentSignatureCompletionSource
	, dependentSignatureCompletionAddedPaths
	, dependentSignatureCompletionChangedPaths
	, dependentSignatureCompletionCommits
	, dependentSignatureCompletionHistoryAddedPaths
	, dependentSignatureCompletionHistoryPath
	, dependentSignatureCompletionImplementation
	, dependentSignatureCompletionImplementationAddedPaths
	, dependentSignatureCompletionIntegrationPaths
	, dependentSignatureCompletionNormalizationPaths
	, dependentSignatureCompletionPredecessor
	, reverseDependentSignatureCompletionUpdate
} from "./dependent-signature-completion-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	dependentSignatureCompletionHistoryPath, "utf8"));

test("dependent signature completion records all twelve first-parent commits"
	, async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "commits", "implementationCommit", "integrationUpdates"
		, "milestone", "predecessorCommit", "reconciledTypeSurfacePointers"
		, "schemaVersion", "scope", "updates"
	].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-signature-completion-source-v1");
	assert.equal(record.predecessorCommit
		, dependentSignatureCompletionPredecessor);
	assert.equal(record.implementationCommit
		, dependentSignatureCompletionImplementation);
	assert.deepEqual(record.commits.map(item => item.commit)
		, dependentSignatureCompletionCommits);
	assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
		, `${dependentSignatureCompletionPredecessor}..${dependentSignatureCompletionImplementation}`])
		.trim().split("\n"), dependentSignatureCompletionCommits);
	for(const [index, item] of record.commits.entries())
	{
		assert.equal(item.parent, index === 0
			? dependentSignatureCompletionPredecessor
			: dependentSignatureCompletionCommits[index - 1]);
		assert.equal(item.subject, git(["show", "-s", "--format=%s"
			, item.commit]).trim());
		assert.deepEqual(item.modified, names(["diff-tree", "--no-commit-id"
			, "--name-only", "--diff-filter=M", "-r", item.commit]));
	}
	assert.deepEqual(names(["diff", "--name-only"
		, dependentSignatureCompletionPredecessor
		, dependentSignatureCompletionImplementation, "--"]), [...new Set([
		...dependentSignatureCompletionChangedPaths
		, ...dependentSignatureCompletionImplementationAddedPaths
		])].sort());}
);

test("dependent signature completion reverses every intermediate source state"
	, async () => {
	const record = await readRecord();
	const expected = record.commits.flatMap(item => item.modified.map(path =>
		`${item.commit}\0${path}`));
	assert.deepEqual(record.updates.map(item => `${item.commit}\0${item.path}`)
		, expected);
	for(const update of record.updates)
	{
		const current = git(["show", `${update.commit}:${update.path}`]);
		const previous = git(["show", `${update.parent}:${update.path}`]);
		assert.equal(reverseDependentSignatureCompletionUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDependentSignatureCompletionSource(
			update.path, current, update.previousSha256), previous, update.path);
	}}
);

test("dependent signature completion additions have exact immutable identities"
	, async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, dependentSignatureCompletionAddedPaths);
	for(const addition of record.additions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, dependentSignatureCompletionPredecessor, "--", addition.path])
			.trim(), "", addition.path);
		const source = dependentSignatureCompletionImplementationAddedPaths
			.includes(addition.path)
			? git(["show"
				, `${dependentSignatureCompletionImplementation}:${addition.path}`])
			: await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
	}
	assert.deepEqual(
		dependentSignatureCompletionHistoryAddedPaths
		, dependentSignatureCompletionAddedPaths.filter(path =>
			!dependentSignatureCompletionImplementationAddedPaths.includes(path))
	);
	}
);

test("dependent signature history integration is newest-first and reversible"
	, async () => {
	const record = await readRecord();
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentSignatureCompletionIntegrationPaths);
	for(const update of record.integrationUpdates)
	{
		const previousDigest = createHash("sha256");
		for await(const chunk of gitSourceBytes(
			dependentSignatureCompletionImplementation, update.path))
			previousDigest.update(chunk);
		assert.equal(previousDigest.digest("hex")
			, update.previousSha256, update.path);
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		await authenticateSourceHistoryReverse(
			[Buffer.from(current)], update);
		if(update.path !== "docs/type-surface.v1.json")
		{
			const previous = git(["show"
				, `${dependentSignatureCompletionImplementation}:${update.path}`]);
			assert.equal(reverseDependentSignatureCompletionUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const path of dependentSignatureCompletionNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("dependent signature integration refreshes only current-source pins"
	, async () => {
	const record = await readRecord();
	const path = "docs/type-surface.v1.json";
	const update = record.integrationUpdates.find(item => item.path === path);
	assert.ok(update);
	assert.equal(update.edits.length, record.reconciledTypeSurfacePointers);
	assert.ok(update.edits.length > 0);
	const pin = /^\s*"sha256": "[a-f0-9]{64}"[,]?\n$/u;
	for(const edit of update.edits)
	{
		assert.match(edit.previous, pin);
		assert.match(edit.current, pin);
		assert.notEqual(edit.previous, edit.current);
	}
	const current = await sourceAtFinHistoryMilestone(
		path, update.currentSha256);
	const previous = git(["show"
		, `${dependentSignatureCompletionImplementation}:${path}`]);
	assert.equal(reverseDependentSignatureCompletionUpdate(current, update)
		, previous);
	}
);

test("dependent signature completion rejects altered transitions", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show", `${update.commit}:${update.path}`]);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }])
		assert.throws(() => reverseDependentSignatureCompletionUpdate(
			current, forged));
	assert.equal(beforeDependentSignatureCompletionSource(
		"unknown.mjs", current), current);
	assert.equal(beforeDependentSignatureCompletionSource(
		update.path, current + "forged"), current + "forged");
});

test("dependent signature history writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-signature-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-dependent-signature-completion-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
