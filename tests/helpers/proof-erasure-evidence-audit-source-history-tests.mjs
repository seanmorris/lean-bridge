/**
 * Authenticate the proof-erasure evidence audit source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeProofErasureEvidenceAuditSource
	, proofErasureEvidenceAuditAddedPaths
	, proofErasureEvidenceAuditCommits
	, proofErasureEvidenceAuditHistoryPath
	, proofErasureEvidenceAuditImplementation
	, proofErasureEvidenceAuditIntegrationPaths
	, proofErasureEvidenceAuditNormalizationPaths
	, proofErasureEvidenceAuditPredecessor
	, reverseProofErasureEvidenceAuditUpdate
} from "./proof-erasure-evidence-audit-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	proofErasureEvidenceAuditHistoryPath, "utf8"
));

test("proof erasure evidence audit records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "proof-erasure-evidence-audit-source-v1");
	assert.equal(value.predecessorCommit, proofErasureEvidenceAuditPredecessor);
	assert.equal(value.implementationCommit, proofErasureEvidenceAuditImplementation);
	assert.deepEqual(value.commits, proofErasureEvidenceAuditCommits);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, proofErasureEvidenceAuditIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, proofErasureEvidenceAuditAddedPaths);
});

test("proof erasure evidence audit reverses every recorded state", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show", `${update.commit}:${update.path}`]);
		const previous = git(["show", `${update.parent}:${update.path}`]);
		assert.equal(reverseProofErasureEvidenceAuditUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeProofErasureEvidenceAuditSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = git(["show"
			, `${proofErasureEvidenceAuditImplementation}:${update.path}`]);
		assert.equal(reverseProofErasureEvidenceAuditUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of proofErasureEvidenceAuditNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("proof erasure evidence audit additions retain exact identities", async () => {
	const value = await record();
	for(const addition of value.additions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, proofErasureEvidenceAuditPredecessor, "--", addition.path]).trim(), "");
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
	}
});

test("proof erasure evidence audit rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show", `${update.commit}:${update.path}`]);
	assert.throws(() => reverseProofErasureEvidenceAuditUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseProofErasureEvidenceAuditUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.equal(beforeProofErasureEvidenceAuditSource(
		update.path, `${current}forged\n`), `${current}forged\n`);
});
