/**
 * Authenticate the direct proof-erasure npm declaration-syntax repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeDirectProofErasureNpmDeclarationSyntaxRepairSource
	, directProofErasureNpmDeclarationSyntaxRepairHistoryAdditions
	, directProofErasureNpmDeclarationSyntaxRepairHistoryPath
	, directProofErasureNpmDeclarationSyntaxRepairImplementation
	, directProofErasureNpmDeclarationSyntaxRepairImplementationAdditions
	, directProofErasureNpmDeclarationSyntaxRepairImplementationPaths
	, directProofErasureNpmDeclarationSyntaxRepairIntegrationPaths
	, directProofErasureNpmDeclarationSyntaxRepairPredecessor
	, reverseDirectProofErasureNpmDeclarationSyntaxRepairUpdate
} from "./direct-proof-erasure-npm-declaration-syntax-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureNpmDeclarationSyntaxRepairHistoryPath, "utf8"));

test("npm declaration-syntax repair records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "direct-proof-erasure-npm-declaration-syntax-repair-source-v1");
	assert.equal(history.predecessorCommit
		, directProofErasureNpmDeclarationSyntaxRepairPredecessor);
	assert.equal(history.implementationCommit
		, directProofErasureNpmDeclarationSyntaxRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, directProofErasureNpmDeclarationSyntaxRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, directProofErasureNpmDeclarationSyntaxRepairIntegrationPaths);
	assert.deepEqual(history.implementationAdditions.map(item => item.path)
		, directProofErasureNpmDeclarationSyntaxRepairImplementationAdditions);
	assert.equal(history.hostedRunId, 41000680672);
	assert.equal(history.failedJobId, 123884392892);
	assert.equal(history.failureCode, "ERR_ASSERTION");
});

test("npm declaration-syntax repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasureNpmDeclarationSyntaxRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureNpmDeclarationSyntaxRepairImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureNpmDeclarationSyntaxRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureNpmDeclarationSyntaxRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("npm declaration-syntax repair checks syntax rather than comments", () => {
	const report = git(["show"
		, `${directProofErasureNpmDeclarationSyntaxRepairImplementation}:tests/helpers/direct-proof-erasure-npm-report.mjs`]);
	const installed = git(["show"
		, `${directProofErasureNpmDeclarationSyntaxRepairImplementation}:tests/direct-proof-erasure-npm-installed.test.mjs`]);
	assert.match(report, /ts\.createSourceFile/u);
	assert.match(report, /ts\.isFunctionDeclaration/u);
	assert.match(report, /keep\.parameters\.length, 1/u);
	assert.match(report, /SyntaxKind\.NumberKeyword/u);
	assert.match(installed
		, /assertDirectProofErasureNpmDeclarationSurface\(declarations, parameter\)/u);
});

test("npm declaration-syntax repair authenticates additions", async () => {
	const history = await record();
	for(const addition of [
		...history.implementationAdditions, ...history.historyAdditions
	]) {
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, directProofErasureNpmDeclarationSyntaxRepairHistoryAdditions);
});

test("npm declaration-syntax repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureNpmDeclarationSyntaxRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureNpmDeclarationSyntaxRepairUpdate(current, forged));
});

test("npm declaration-syntax repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-npm-declaration-syntax-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /direct-proof-erasure-npm-declaration-syntax-repair-source-history-20261030\.json/u);
});
