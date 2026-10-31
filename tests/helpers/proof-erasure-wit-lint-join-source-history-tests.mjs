/**
 * Authenticate the WIT proof-erasure/lint-repair two-parent join.
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
	beforeProofErasureWitLintJoinSource
	, proofErasureWitLintJoinAddedPaths
	, proofErasureWitLintJoinChangedPaths
	, proofErasureWitLintJoinCommonAncestor
	, proofErasureWitLintJoinHistoryPath
	, proofErasureWitLintJoinImplementation
	, proofErasureWitLintJoinIntegrationPaths
	, proofErasureWitLintJoinLeftParent
	, proofErasureWitLintJoinMerge
	, proofErasureWitLintJoinPinCount
	, proofErasureWitLintJoinPinPath
	, proofErasureWitLintJoinRightParent
	, reverseProofErasureWitLintJoinUpdate
} from "./proof-erasure-wit-lint-join-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource
} from "./source-at-fin-history-milestone.mjs";

const sourceAtJoin = (path, expected) => sourceAtFinHistoryRecordSource(
	proofErasureWitLintJoinHistoryPath, path, expected
	, beforeProofErasureWitLintJoinSource
);

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	proofErasureWitLintJoinHistoryPath, "utf8"
));

test("WIT/lint local join records its exact two-parent synthesis", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "proof-erasure-wit-lint-join-source-v1");
	assert.equal(value.commonAncestorCommit
		, proofErasureWitLintJoinCommonAncestor);
	assert.equal(value.leftParentCommit, proofErasureWitLintJoinLeftParent);
	assert.equal(value.rightParentCommit, proofErasureWitLintJoinRightParent);
	assert.equal(value.mergeCommit, proofErasureWitLintJoinMerge);
	assert.equal(value.implementationCommit
		, proofErasureWitLintJoinImplementation);
	assert.deepEqual(git(["show", "-s", "--format=%P"
		, proofErasureWitLintJoinMerge]).trim().split(" "), [
		proofErasureWitLintJoinLeftParent, proofErasureWitLintJoinRightParent]
	);
	assert.deepEqual(value.leftUpdates.map(update => update.path)
		, proofErasureWitLintJoinChangedPaths);
	assert.deepEqual(value.rightUpdates.map(update => update.path)
		, proofErasureWitLintJoinChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, proofErasureWitLintJoinIntegrationPaths);
	assert.equal(value.pinUpdate.path, proofErasureWitLintJoinPinPath);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, proofErasureWitLintJoinAddedPaths);
});

test("WIT/lint local join reverses live integration to either parent", async () => {
	const value = await record();
	for(const path of proofErasureWitLintJoinChangedPaths)
	{
		const integration = value.integrationUpdates.find(
			update => update.path === path);
		const live = await sourceAtJoin(
			path, integration.currentSha256);
		const merged = reverseProofErasureWitLintJoinUpdate(
			live, integration
		);
		const leftUpdate = value.leftUpdates.find(update => update.path === path);
		const rightUpdate = value.rightUpdates.find(update => update.path === path);
		assert.equal(sha256(merged), leftUpdate.currentSha256, path);
		const left = reverseProofErasureWitLintJoinUpdate(merged, leftUpdate);
		const right = reverseProofErasureWitLintJoinUpdate(merged, rightUpdate);
		assert.equal(left, git(["show"
			, `${proofErasureWitLintJoinLeftParent}:${path}`]), path);
		assert.equal(right, git(["show"
			, `${proofErasureWitLintJoinRightParent}:${path}`]), path);
		assert.equal(beforeProofErasureWitLintJoinSource(
			path, live, sha256(left)), left, path);
		assert.equal(beforeProofErasureWitLintJoinSource(
			path, live, sha256(right)), right, path);
		assert.ok(finRefinementNormalizationPaths.includes(path));
	}
});

test("exact history reconstruction reaches both WIT/lint branch parents", async () => {
	const path = "tests/helpers/fin-refinement-source-history.mjs";
	for(const revision of [proofErasureWitLintJoinLeftParent
		, proofErasureWitLintJoinRightParent
		, proofErasureWitLintJoinCommonAncestor]) {
		const expected = git(["show", `${revision}:${path}`]);
		assert.equal(await sourceAtFinHistoryMilestone(path, sha256(expected))
			, expected, revision);
		}
});

test("WIT/lint local join refreshes exactly the merged workflow pins", async () => {
	const value = await record(), update = value.pinUpdate;
	assert.equal(update.edits.length, proofErasureWitLintJoinPinCount);
	assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
		proofErasureWitLintJoinImplementation, update.path), update), true);
	const previous = git(["show"
		, `${proofErasureWitLintJoinMerge}:${update.path}`]);
	const current = git(["show"
		, `${proofErasureWitLintJoinImplementation}:${update.path}`]);
	assert.equal(reverseProofErasureWitLintJoinUpdate(current, update), previous);
	const workflowDigest = sha256(git(["show"
		, `${proofErasureWitLintJoinMerge}:.github/workflows/consumer-matrix.yml`]));
	const previousWorkflowDigest = sha256(git(["show"
		, `${proofErasureWitLintJoinCommonAncestor}:.github/workflows/consumer-matrix.yml`]));
	for(const edit of update.edits)
	{
		assert.equal(edit.current.replace(workflowDigest, "<digest>")
			, edit.previous.replace(previousWorkflowDigest, "<digest>"));
		assert.ok(edit.current.includes(workflowDigest));
		assert.ok(edit.previous.includes(previousWorkflowDigest));
	}
	assert.ok(finRefinementNormalizationPaths.includes(update.path));
	assert.equal(beforeFinRefinementSource(
		update.path, current, update.previousSha256), previous);
});

test("WIT/lint local join additions and refusals remain exact", async () => {
	const value = await record();
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtJoin(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
	const update = value.leftUpdates[0];
	const current = git(["show"
		, `${proofErasureWitLintJoinMerge}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseProofErasureWitLintJoinUpdate(
		current, forged));
});

test("WIT/lint local-join writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-proof-wit-lint-join-"));
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
		"scripts/update-proof-erasure-wit-lint-join-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact pin-refresh commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
