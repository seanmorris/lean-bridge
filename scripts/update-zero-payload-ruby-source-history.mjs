#!/usr/bin/env node
/**
 * Record the exact zero-payload Ruby package source milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	zeroPayloadRubyHistoryApplicationPaths
	, zeroPayloadRubyHistoryChangedPaths
	, zeroPayloadRubyHistoryHistoryPath
	, zeroPayloadRubyHistoryImplementation
	, zeroPayloadRubyHistoryIntegrationPaths
	, zeroPayloadRubyHistoryPredecessor
	, reverseZeroPayloadRubyHistoryUpdate
} from "../tests/helpers/zero-payload-ruby-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, zeroPayloadRubyHistoryImplementation
	, "Zero-payload Ruby history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadRubyHistoryHistoryPath]).trim(), ""
, "Never rewrite committed zero-payload Ruby history");

const addedPaths = Object.freeze([
	"scripts/update-zero-payload-ruby-source-history.mjs"
	, "tests/helpers/zero-payload-ruby-source-history.mjs"
	, "tests/helpers/zero-payload-ruby-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const implementationTypeSurface = JSON.parse(git(["show"
	, `${zeroPayloadRubyHistoryImplementation}:${typeSurfacePath}`]));
const actualHashes = new Map();
for(const evidence of typeSurface.evidence)
	for(const file of evidence.files)
	{
		let actual = actualHashes.get(file.path);
		if(actual === undefined)
		{
			actual = sha256(await readFile(file.path));
			actualHashes.set(file.path, actual);
		}
		if(file.sha256 !== actual) file.sha256 = actual;
	}
const implementationHashes = new Map();
for(const evidence of implementationTypeSurface.evidence)
	for(const file of evidence.files)
		implementationHashes.set(`${evidence.id}\0${file.path}`, file.sha256);
const advanced = typeSurface.evidence.reduce((count, evidence) => count
	+ evidence.files.filter(file => implementationHashes.get(
		`${evidence.id}\0${file.path}`
	) !== file.sha256).length, 0);
assert.ok(advanced > 0
	, "Type-surface reconciliation must advance the implementation snapshot");
await writeFile(typeSurfacePath
	, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-zero-payload-ruby-history-"
));
const transition = async (path, revision) => {
	const previous = git(["show", `${revision}:${path}`]);
	const current = await readFile(path, "utf8");
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = git(["diff", "--histogram", "--no-index"
			, "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0"
			, previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.equal(reverseZeroPayloadRubyHistoryUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadRubyHistoryChangedPaths)
		updates.push(await transition(
			path, zeroPayloadRubyHistoryImplementation
		));
	const integrationUpdates = [];
	for(const path of zeroPayloadRubyHistoryIntegrationPaths)
		integrationUpdates.push(await transition(
			path, zeroPayloadRubyHistoryImplementation
		));
	const additions = [];
	for(const path of zeroPayloadRubyHistoryApplicationPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadRubyHistoryPredecessor, "--", path])
			.trim(), "", path);
		assert.notEqual(git(["ls-tree", "--name-only"
			, zeroPayloadRubyHistoryImplementation, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadRubyHistoryImplementation, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadRubyHistoryImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		"docs/type-surface.v1.json"
		, ...zeroPayloadRubyHistoryChangedPaths
		, ...zeroPayloadRubyHistoryIntegrationPaths
	].sort());
	const record = {
		schemaVersion: 1
		, milestone: "zero-payload-ruby-source-v1"
		, predecessorCommit: zeroPayloadRubyHistoryPredecessor
		, implementationCommit: zeroPayloadRubyHistoryImplementation
		, reconciledTypeSurfacePointers: advanced
		, scope: "Generated Ruby keeps proof-only, UNIT-bearing and plain empty records, Option, arrays and both variant branches nominally distinct across full and result-only gem routes on the declared MRI 3.3 floor."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadRubyHistoryHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(
		`Recorded ${updates.length} update, ${integrationUpdates.length} integrations, ${additions.length} additions and ${advanced} type-surface pointers.\n`
	);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
