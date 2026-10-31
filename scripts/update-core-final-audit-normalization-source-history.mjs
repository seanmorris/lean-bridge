#!/usr/bin/env node
/**
 * Record reversible transitions for every final-audit source.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	coreFinalAuditNormalizationBaseline
	, coreFinalAuditNormalizationHistoryAdditions
	, coreFinalAuditNormalizationHistoryPath
	, coreFinalAuditNormalizationIntegrationPaths
} from "../tests/helpers/core-final-audit-normalization-source-history.mjs";
import {
	coreFinalTypeSurfaceAuditHistoryPath
	, coreFinalTypeSurfaceAuditMilestones
} from "../tests/helpers/core-final-type-surface-audit-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-core-final-audit-normalization-source-history.mjs");
assert.equal(existsSync(coreFinalAuditNormalizationHistoryPath), false
	, coreFinalAuditNormalizationHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, coreFinalAuditNormalizationBaseline);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...coreFinalAuditNormalizationIntegrationPaths])
, [...coreFinalAuditNormalizationIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreFinalAuditNormalizationHistoryAdditions])
, [...coreFinalAuditNormalizationHistoryAdditions].sort());

const original = JSON.parse(await readFile(
	coreFinalTypeSurfaceAuditHistoryPath, "utf8"));
assert.deepEqual(original.milestones.map(item => ({
	role: item.role, commit: item.commit, parent: item.parent
	, tree: item.tree, subject: item.subject
})), coreFinalTypeSurfaceAuditMilestones);

const milestones = [];
for(const milestone of original.milestones)
{
	const statuses = new Set(milestone.changes.map(change => change.status));
	assert.ok([...statuses].every(status => status === "M" || status === "A"));
	const modified = milestone.changes
		.filter(change => change.status === "M");
	const added = milestone.changes
		.filter(change => change.status === "A");
	const updates = [];
	for(const change of modified)
		updates.push(await gitSourceHistoryTransition(change.path
			, milestone.parent, milestone.commit
			, { maximumEditBytes: 128 * 1024 * 1024 }));
	const additions = added.map(change => {
		const source = git(["show", milestone.commit + ":" + change.path]);
		return { path: change.path, sha256: sha256(source) };
	});
	milestones.push({
		role: milestone.role, commit: milestone.commit
		, parent: milestone.parent, tree: milestone.tree
		, subject: milestone.subject, updates, additions
	});
	process.stdout.write("Captured " + updates.length + " modified and "
		+ additions.length + " added sources for " + milestone.role + ".\n");
}
assert.deepEqual(milestones.map(item => item.updates.length), [167, 1, 2]);
assert.deepEqual(milestones.map(item => item.additions.length), [1, 1, 0]);

const directory = await mkdtemp(join(
	tmpdir(), "lean-core-final-audit-normalization-"));
try
{
	const environment = {
		...process.env, GIT_INDEX_FILE: join(directory, "index")
		, GIT_AUTHOR_NAME: "Lean Bridge history writer"
		, GIT_AUTHOR_EMAIL: "history@example.invalid"
		, GIT_COMMITTER_NAME: "Lean Bridge history writer"
		, GIT_COMMITTER_EMAIL: "history@example.invalid"
		, GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z"
		, GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z"
	};
	const temporaryGit = (arguments_, options = {}) => execFileSync(
		"git", arguments_, {
			encoding: "utf8", maxBuffer: 512 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", coreFinalAuditNormalizationBaseline]);
	temporaryGit(["add", "--sparse", "--"
		, ...coreFinalAuditNormalizationIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", coreFinalAuditNormalizationBaseline
	], { input: "Register complete final-audit normalization\n" }).trim();
	const integrationUpdates = [];
	for(const path of coreFinalAuditNormalizationIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, coreFinalAuditNormalizationBaseline, integrationCommit
			, { maximumEditBytes: 128 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of coreFinalAuditNormalizationHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(coreFinalAuditNormalizationHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "core-final-audit-normalization-source-v1"
		, baselineCommit: coreFinalAuditNormalizationBaseline
		, sourceLedger: coreFinalTypeSurfaceAuditHistoryPath
		, scope: "Add every modified source from the three final type-surface audit milestones to the reversible normalization chain in one complete pass. Preserve and authenticate both historical additions. Register the new reader ahead of all older history readers so one later transition cannot hide the next stale endpoint. Accept the exact retained commit-only edit schema while continuing to validate its commit, digests, path and nonempty edit set."
		, milestones, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write("Recorded 170 historical transitions, 2 historical "
		+ "additions and " + integrationUpdates.length
		+ " integration transitions.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
