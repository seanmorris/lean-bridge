/**
 * Preserve the exact inherited checked-record documentation correction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import {
	beforeInheritedCheckedRecordDocsClosureSource
	, inheritedCheckedRecordDocsClosureAddedPaths
	, inheritedCheckedRecordDocsClosureChangedPaths
	, inheritedCheckedRecordDocsClosureDraftParent
	, inheritedCheckedRecordDocsClosureHistoryPath
	, inheritedCheckedRecordDocsClosurePredecessor
	, reverseInheritedCheckedRecordDocsClosureUpdate
} from "./inherited-checked-record-docs-closure-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});

const consumerGuides = Object.freeze([
	"docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/consume/dotnet.md"
	, "docs/consume/perl.md"
	, "docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md"
	, "docs/javascript-typescript.md"
	, "docs/php.md"
]);

test("inherited checked-record docs closure has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordDocsClosureHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "inherited-checked-record-docs-closure-source-v1");
	assert.equal(record.predecessorCommit
		, inheritedCheckedRecordDocsClosurePredecessor);
	assert.equal(record.draftParentCommit
		, inheritedCheckedRecordDocsClosureDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, inheritedCheckedRecordDocsClosureChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, inheritedCheckedRecordDocsClosureAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		inheritedCheckedRecordDocsClosureChangedPaths)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeInheritedCheckedRecordDocsClosureSource
		);
		const previous = git(["show"
			, `${inheritedCheckedRecordDocsClosurePredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseInheritedCheckedRecordDocsClosureUpdate(
			current, update), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordDocsClosureSource(
			update.path, current), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordDocsClosureSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		const unknown = current + "unknown";
		assert.equal(beforeInheritedCheckedRecordDocsClosureSource(
			update.path, unknown), unknown, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseInheritedCheckedRecordDocsClosureUpdate(
				current, changed
			));
		}
	}
});

test("inherited checked-record docs closure authenticates its additions", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordDocsClosureHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${inheritedCheckedRecordDocsClosurePredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("inherited checked-record docs closure refreshes only matching source pins", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordDocsClosureHistoryPath, "utf8"));
	const updates = new Map(record.updates.map(update => [update.path, update]));
	const inventoryPath = "docs/type-surface.v1.json";
	const inventoryUpdate = updates.get(inventoryPath);
	const current = JSON.parse(await sourceAtFinHistoryMilestone(
		inventoryPath, inventoryUpdate.currentSha256
		, beforeInheritedCheckedRecordDocsClosureSource
	));
	const previous = JSON.parse(beforeInheritedCheckedRecordDocsClosureSource(
		inventoryPath, JSON.stringify(current, null, 2) + "\n"
	));
	let pinCount = 0;
	const pinUpdates = [];
	for(const [path, update] of updates)
	{
		if(path === inventoryPath) continue;
		let count = 0;
		for(const entry of previous.evidence) for(const file of entry.files)
			if(file.path === path && file.sha256 === update.previousSha256)
			{
				file.sha256 = update.currentSha256;
				count++;
			}
		if(count)
		{
			pinCount += count;
			pinUpdates.push({
				path, previousSha256: update.previousSha256
				, currentSha256: update.currentSha256, count
			});
		}
	}
	assert.equal(pinCount, record.pinCount);
	assert.deepEqual(pinUpdates, record.pinUpdates);
	assert.deepEqual(previous, current);
});

test("consumer and author docs state the tested inherited checked-record boundary", async () => {
	const stale = /(?:generic,? recursive (?:and|or)|generic, recursive,)[^\n]{0,40}inherited(?: checked records?)?/iu;
	const receiverBoundary
		= /value-carrying receiver-dependent (?:inherited )?fields/u;
	for(const path of consumerGuides)
	{
		const source = await readFile(path, "utf8");
		assert.match(source
			, /inherited-checked-record-promotion-20261018\.md/u, path);
		assert.match(source, /Span → Ticket → Stamped/u, path);
		assert.match(source, receiverBoundary, path);
		assert.doesNotMatch(source, stale, path);
	}
	const author = await readFile("docs/lean/existing-package.md", "utf8");
	const section = author.split("#### Checked inherited records\n")[1]
		?.split("### Export a checked Subtype\n")[0];
	assert.ok(section);
	assert.match(section, /all seventeen consumer profiles/u);
	assert.match(section, /refinement\.fields/u);
	assert.match(section, /dependency order/u);
	assert.match(section, /Repeated parameters may select different constructor trees/u);
	assert.match(section, /result-only packages project the same proof-free payload/u);
	assert.match(section, /inherited-checked-record-fixture\.mjs/u);
	assert.match(section, /InheritedCheckedRecords\.lean/u);
	assert.match(section, receiverBoundary);
	assert.doesNotMatch(section, stale);
	const decisions = await readFile("docs/lean/export-decisions.md", "utf8");
	assert.match(decisions
		, /inherited-checked-record-promotion-20261018\.md/u);
	assert.match(decisions, /independently selected parent and child constructors/u);
	assert.match(decisions, receiverBoundary);
	assert.doesNotMatch(decisions, stale);
});

test("inherited checked-record docs writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-inherited-record-docs-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-inherited-checked-record-docs-closure-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
