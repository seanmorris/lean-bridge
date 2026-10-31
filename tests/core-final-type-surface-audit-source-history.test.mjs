/**
 * Authenticate the final Core type-surface audit as three separate milestones.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import {
	coreFinalTypeSurfaceAuditHistoryAdditions
	, coreFinalTypeSurfaceAuditHistoryPath
	, coreFinalTypeSurfaceAuditMilestones
} from "./helpers/core-final-type-surface-audit-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024, ...options
});
const record = JSON.parse(await readFile(
	coreFinalTypeSurfaceAuditHistoryPath, "utf8"));

const objectSizes = objectIds => {
	const ids = [...new Set(objectIds.filter(id => !/^0+$/u.test(id)))];
	const source = git(["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], {
		input: `${ids.join("\n")}\n`
	});
	return new Map(source.trim().split("\n").filter(Boolean).map(line => {
		const [id, type, bytes] = line.split(" ");
		assert.equal(type, "blob", id);
		return [id, Number(bytes)];
	}));
};

const changesAt = commit => {
	const tokens = git(["diff-tree", "--no-commit-id", "--raw", "-r", "-z"
		, "--no-renames", "--abbrev=40", commit]).split("\0");
	assert.equal(tokens.pop(), "");
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

test("final type-surface audit retains three contiguous exact milestones", () => {
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-final-type-surface-audit-source-v1");
	assert.match(record.scope, /one stale row from hiding the rest/u);
	assert.deepEqual(record.milestones.map(milestone => ({
		role: milestone.role, commit: milestone.commit, parent: milestone.parent
		, tree: milestone.tree, subject: milestone.subject
	})), coreFinalTypeSurfaceAuditMilestones);
	for(const milestone of record.milestones)
	{
		assert.equal(git(["rev-parse", `${milestone.commit}^`]).trim()
			, milestone.parent);
		assert.equal(git(["rev-parse", `${milestone.commit}^{tree}`]).trim()
			, milestone.tree);
		assert.equal(git(["show", "-s", "--format=%s", milestone.commit]).trim()
			, milestone.subject);
		assert.deepEqual(changesAt(milestone.commit), milestone.changes);
	}
	assert.equal(record.milestones[0].changes.length, 168);
	assert.deepEqual(record.milestones[1].changes.map(change => change.path), [
		"docs/type-surface.v1.json"
		, "scripts/reconcile-core-semantic-gate-live-pins.mjs"
	]);
	assert.deepEqual(record.milestones[2].changes.map(change => change.path), [
		"tests/type-surface-docs.test.mjs", "tests/type-surface.test.mjs"
	]);
});

test("final audit history additions retain their exact source bytes", async () => {
	assert.deepEqual(record.historyAdditions.map(addition => addition.path)
		, coreFinalTypeSurfaceAuditHistoryAdditions);
	for(const addition of record.historyAdditions)
		assert.equal(sha256(await readFile(addition.path)), addition.sha256
			, addition.path);
});
