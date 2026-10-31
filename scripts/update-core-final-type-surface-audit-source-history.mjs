#!/usr/bin/env node
/**
 * Record the complete behavior, live-pin and exact-model audit sequence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	coreFinalTypeSurfaceAuditHistoryAdditions
	, coreFinalTypeSurfaceAuditHistoryPath
	, coreFinalTypeSurfaceAuditMilestones
} from "../tests/helpers/core-final-type-surface-audit-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024, ...options
});

const objectSizes = objectIds => {
	const ids = [...new Set(objectIds.filter(id => !/^0+$/u.test(id)))];
	if(ids.length === 0) return new Map();
	const source = git(["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], {
		input: `${ids.join("\n")}\n`
	});
	return new Map(source.trim().split("\n").map(line => {
		const [id, type, bytes] = line.split(" ");
		assert.equal(type, "blob", id);
		return [id, Number(bytes)];
	}));
};

const changesAt = commit => {
	const tokens = git(["diff-tree", "--no-commit-id", "--raw", "-r", "-z"
		, "--no-renames", "--abbrev=40", commit]).split("\0");
	assert.equal(tokens.pop(), "");
	assert.equal(tokens.length % 2, 0);
	const parsed = [];
	for(let index = 0; index < tokens.length; index += 2)
	{
		const match = /^:(\d+) (\d+) ([0-9a-f]{40}) ([0-9a-f]{40}) ([AMD])$/u
			.exec(tokens[index]);
		assert.ok(match, tokens[index]);
		parsed.push({
			path: tokens[index + 1], status: match[5]
			, beforeMode: match[1], afterMode: match[2]
			, beforeObject: match[3], afterObject: match[4]
		});
	}
	const sizes = objectSizes(parsed.flatMap(change =>
		[change.beforeObject, change.afterObject]));
	return parsed.map(change => ({
		path: change.path, status: change.status
		, before: /^0+$/u.test(change.beforeObject) ? null : {
			mode: change.beforeMode, object: change.beforeObject
			, bytes: sizes.get(change.beforeObject)
		}
		, after: /^0+$/u.test(change.afterObject) ? null : {
			mode: change.afterMode, object: change.afterObject
			, bytes: sizes.get(change.afterObject)
		}
	}));
};

const head = git(["rev-parse", "HEAD"]).trim();
assert.equal(head, coreFinalTypeSurfaceAuditMilestones.at(-1).commit
	, "final audit history must be recorded at the exact-model implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, coreFinalTypeSurfaceAuditHistoryPath]).trim(), "");
const untracked = git(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreFinalTypeSurfaceAuditHistoryAdditions]).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(untracked, [...coreFinalTypeSurfaceAuditHistoryAdditions].sort());

const milestones = coreFinalTypeSurfaceAuditMilestones.map(expected => {
	const actual = {
		role: expected.role, commit: expected.commit
		, parent: git(["rev-parse", `${expected.commit}^`]).trim()
		, tree: git(["rev-parse", `${expected.commit}^{tree}`]).trim()
		, subject: git(["show", "-s", "--format=%s", expected.commit]).trim()
	};
	assert.deepEqual(actual, expected);
	return { ...actual, changes: changesAt(expected.commit) };
});
assert.equal(milestones[0].changes.length, 168);
assert.deepEqual(milestones[1].changes.map(change => change.path), [
	"docs/type-surface.v1.json"
	, "scripts/reconcile-core-semantic-gate-live-pins.mjs"
]);
assert.deepEqual(milestones[2].changes.map(change => change.path), [
	"tests/type-surface-docs.test.mjs", "tests/type-surface.test.mjs"
]);

const historyAdditions = [];
for(const path of coreFinalTypeSurfaceAuditHistoryAdditions)
	historyAdditions.push({ path, sha256: sha256(await readFile(path)) });

await writeFile(coreFinalTypeSurfaceAuditHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "core-final-type-surface-audit-source-v1"
	, scope: "Authenticate the contiguous behavior, current live-source citation, exact type-surface model and generated-documentation closure. Preserve separate semantic and final snapshot gates, all changed-path and Git blob identities, and the complete mismatch aggregation that prevents one stale row from hiding the rest of its matrix."
	, milestones, historyAdditions
}), { flag: "wx" });
process.stdout.write(`Recorded ${milestones.length} milestones and ${milestones
	.reduce((count, milestone) => count + milestone.changes.length, 0)} exact changes.\n`);

