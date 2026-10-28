/**
 * Authenticate the proof/Core two-parent local join.
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
	beforeProofCoreLocalJoinSource
	, proofCoreLocalJoinAddedPaths
	, proofCoreLocalJoinChangedPaths
	, proofCoreLocalJoinCommonAncestor
	, proofCoreLocalJoinHistoryPath
	, proofCoreLocalJoinLeftParent
	, proofCoreLocalJoinMerge
	, proofCoreLocalJoinRightParent
	, reverseProofCoreLocalJoinUpdate
} from "./proof-core-local-join-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { gitSourceBytes } from "./source-history-stream.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	proofCoreLocalJoinHistoryPath, "utf8"
));
const gitSha256 = async (revision, path) => {
	const digest = createHash("sha256");
	for await(const chunk of gitSourceBytes(revision, path)) digest.update(chunk);
	return digest.digest("hex");
};

test("proof/Core local join records its exact two-parent synthesis", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "commonAncestorCommit", "integrationUpdates"
		, "leftOnlyExpectedSha256", "leftParentCommit", "leftUpdates"
		, "mergeCommit", "milestone", "rightPreferredExpectedSha256"
		, "rightParentCommit", "rightUpdates", "schemaVersion", "scope"
	].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "proof-core-local-join-source-v1");
	assert.equal(record.commonAncestorCommit
		, proofCoreLocalJoinCommonAncestor);
	assert.equal(record.leftParentCommit, proofCoreLocalJoinLeftParent);
	assert.equal(record.rightParentCommit, proofCoreLocalJoinRightParent);
	assert.equal(record.mergeCommit, proofCoreLocalJoinMerge);
	const parents = git(["show", "-s", "--format=%P"
		, proofCoreLocalJoinMerge]).trim().split(" ");
	assert.deepEqual(parents, [
		proofCoreLocalJoinLeftParent, proofCoreLocalJoinRightParent
	]);
	assert.deepEqual(record.leftUpdates.map(update => update.path)
		, proofCoreLocalJoinChangedPaths);
	assert.deepEqual(record.rightUpdates.map(update => update.path)
		, proofCoreLocalJoinChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path), [
		"tests/checked-javascript-partition-10.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, proofCoreLocalJoinAddedPaths);
	for(const path of proofCoreLocalJoinChangedPaths)
	{
		assert.deepEqual(record.leftOnlyExpectedSha256[path]
			, [...record.leftOnlyExpectedSha256[path]].sort());
		assert.ok(record.rightPreferredExpectedSha256[path].includes(
			record.rightUpdates.find(update => update.path === path)
				.previousSha256), path);
		assert.deepEqual(record.rightPreferredExpectedSha256[path]
			, [...record.rightPreferredExpectedSha256[path]].sort());
	}
});

test("proof/Core local join reverses live integration to either parent", async () => {
	const record = await readRecord();
	for(const path of proofCoreLocalJoinChangedPaths)
	{
		const live = await readFile(path, "utf8");
		const integration = record.integrationUpdates.find(
			update => update.path === path);
		const integrated = integration === undefined ? live
			: beforeFinRefinementSource(
				path, live, integration.currentSha256
			);
		const merged = integration === undefined ? integrated
			: reverseProofCoreLocalJoinUpdate(integrated, integration);
		assert.equal(sha256(merged)
			, record.leftUpdates.find(update => update.path === path)
				.currentSha256, path);
		const left = reverseProofCoreLocalJoinUpdate(merged
			, record.leftUpdates.find(update => update.path === path));
		const right = reverseProofCoreLocalJoinUpdate(merged
			, record.rightUpdates.find(update => update.path === path));
		assert.equal(sha256(left)
			, await gitSha256(proofCoreLocalJoinLeftParent, path), path);
		assert.equal(sha256(right)
			, await gitSha256(proofCoreLocalJoinRightParent, path), path);
		assert.equal(beforeProofCoreLocalJoinSource(path, integrated, sha256(left))
			, left, path);
		assert.equal(beforeProofCoreLocalJoinSource(path, integrated, sha256(right))
			, right, path);
		assert.ok(finRefinementNormalizationPaths.includes(path));
	}
});

test("global Fin history reaches both branch parents and their ancestor", async () => {
	const path = "tests/helpers/fin-refinement-source-history.mjs";
	const live = await readFile(path, "utf8");
	for(const revision of [proofCoreLocalJoinLeftParent
		, proofCoreLocalJoinRightParent, proofCoreLocalJoinCommonAncestor]) {
		const expected = git(["show", `${revision}:${path}`]);
		assert.equal(beforeFinRefinementSource(path, live, sha256(expected))
			, expected, revision);
		}
});

test("proof/Core local join rejects forged transitions", async () => {
	const record = await readRecord();
	const update = record.leftUpdates.find(item => item.path
		=== "tests/checked-javascript-partition-10.test.mjs");
	const current = git(["show"
		, `${proofCoreLocalJoinMerge}:${update.path}`]);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseProofCoreLocalJoinUpdate(current, forged));
	const unknown = `${current}unknown\n`;
	assert.equal(beforeProofCoreLocalJoinSource(update.path, unknown), unknown);
	for(const addition of record.additions)
	{
		const source = beforeFinRefinementSource(
			addition.path, await readFile(addition.path), addition.currentSha256
		);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
	}
});

test("proof/Core local-join writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-proof-core-local-join-"));
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
		"scripts/update-proof-core-local-join-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact merge commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
