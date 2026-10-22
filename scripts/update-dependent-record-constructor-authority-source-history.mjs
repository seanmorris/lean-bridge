#!/usr/bin/env node
/**
 * Record the exact dependent checked-record constructor-authority repair and
 * reconcile only evidence pointers that name its changed sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import {
	dependentRecordConstructorAuthorityAddedPaths
	, dependentRecordConstructorAuthorityHistoricalPaths
	, dependentRecordConstructorAuthorityHistoryPath
	, dependentRecordConstructorAuthorityImplementation
	, dependentRecordConstructorAuthorityIntegrationPaths
	, dependentRecordConstructorAuthorityPredecessor
	, reverseDependentRecordConstructorAuthorityUpdate
} from "../tests/helpers/dependent-record-constructor-authority-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const lines = value => value.split("\n").filter(Boolean);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentRecordConstructorAuthorityImplementation
	, "Dependent-record constructor-authority history is draft-only at its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, dependentRecordConstructorAuthorityPredecessor
	, "Dependent-record constructor-authority repair must keep its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, dependentRecordConstructorAuthorityHistoryPath]).trim(), ""
, "Never rewrite committed dependent-record constructor-authority history");
assert.deepEqual(lines(git(["diff", "--name-only"
	, dependentRecordConstructorAuthorityPredecessor
	, dependentRecordConstructorAuthorityImplementation])).sort()
, [...dependentRecordConstructorAuthorityHistoricalPaths].sort());
assert.deepEqual(lines(git(["ls-files", "--others", "--exclude-standard", "--"
	, ...dependentRecordConstructorAuthorityAddedPaths])).sort()
, [...dependentRecordConstructorAuthorityAddedPaths].sort());

const sourceTransitions = new Map();
for(const path of dependentRecordConstructorAuthorityHistoricalPaths)
{
	const previous = git(["show"
		, `${dependentRecordConstructorAuthorityPredecessor}:${path}`]);
	const current = git(["show"
		, `${dependentRecordConstructorAuthorityImplementation}:${path}`]);
	sourceTransitions.set(path, {
		previous: sha256(previous), current: sha256(current)
	});
}
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const pointerUpdates = [];
for(const evidence of typeSurface.evidence)
	for(const file of evidence.files)
	{
		const source = sourceTransitions.get(file.path);
		if(source === undefined) continue;
		assert.ok([source.previous, source.current].includes(file.sha256)
			, `${evidence.id}: unexpected ${file.path} source pin`);
		file.sha256 = source.current;
		pointerUpdates.push({ evidence: evidence.id, path: file.path
			, previous: source.previous, current: source.current });
	}
assert.ok(pointerUpdates.length > 0
	, "The constructor-authority repair must refresh source pointers");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

assert.deepEqual(lines(git(["diff", "--name-only", "--diff-filter=M"
	, dependentRecordConstructorAuthorityImplementation, "--"])).sort()
, [...dependentRecordConstructorAuthorityIntegrationPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "dependent-record-constructor-authority-history-"
));
const transition = async (path, previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = git(["diff", "--histogram", "--no-index", "--no-ext-diff"
			, "--no-textconv", "--no-color", "--unified=0"
			, previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const offsets = [0];
	for(const line of currentLines) offsets.push(offsets.at(-1) + line.length);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: offsets[currentStart]
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.equal(reverseDependentRecordConstructorAuthorityUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of dependentRecordConstructorAuthorityHistoricalPaths)
		updates.push(await transition(path
			, git(["show"
				, `${dependentRecordConstructorAuthorityPredecessor}:${path}`])
			, git(["show"
				, `${dependentRecordConstructorAuthorityImplementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of dependentRecordConstructorAuthorityIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show"
				, `${dependentRecordConstructorAuthorityImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of dependentRecordConstructorAuthorityAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${dependentRecordConstructorAuthorityPredecessor}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(dependentRecordConstructorAuthorityHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "dependent-record-constructor-authority-source-v1"
			, predecessorCommit: dependentRecordConstructorAuthorityPredecessor
			, implementationCommit: dependentRecordConstructorAuthorityImplementation
			, repairedTypeSurfacePointers: pointerUpdates.length
			, pointerUpdates, updates, integrationUpdates, additions
		}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} integrations, ${additions.length} additions `
		+ `and ${pointerUpdates.length} refreshed pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
