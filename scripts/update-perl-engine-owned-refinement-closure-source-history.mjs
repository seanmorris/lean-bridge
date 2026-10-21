#!/usr/bin/env node
/**
 * Record the exact filtered-Perl-engine owned-refinement import closure.
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
	perlEngineOwnedRefinementClosureChangedPaths
	, perlEngineOwnedRefinementClosureHistoryPath
	, perlEngineOwnedRefinementClosureImplementation
	, perlEngineOwnedRefinementClosureIntegrationPaths
	, perlEngineOwnedRefinementClosurePredecessor
	, reversePerlEngineOwnedRefinementClosureUpdate
} from "../tests/helpers/perl-engine-owned-refinement-closure-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, perlEngineOwnedRefinementClosureImplementation
	, "Perl engine owned-refinement closure history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, perlEngineOwnedRefinementClosureHistoryPath]).trim(), ""
, "Never rewrite committed Perl engine owned-refinement closure history");

const addedPaths = Object.freeze([
	"scripts/update-perl-engine-owned-refinement-closure-source-history.mjs"
	, "tests/helpers/perl-engine-owned-refinement-closure-source-history.mjs"
	, "tests/helpers/perl-engine-owned-refinement-closure-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const implementationTypeSurface = JSON.parse(git(["show"
	, `${perlEngineOwnedRefinementClosureImplementation}:${typeSurfacePath}`]));
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
	tmpdir(), "lean-bridge-perl-owned-refinement-closure-history-"
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
	assert.equal(reversePerlEngineOwnedRefinementClosureUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of perlEngineOwnedRefinementClosureChangedPaths)
		updates.push(await transition(
			path, perlEngineOwnedRefinementClosurePredecessor
		));
	const integrationUpdates = [];
	for(const path of perlEngineOwnedRefinementClosureIntegrationPaths)
		integrationUpdates.push(await transition(
			path, perlEngineOwnedRefinementClosureImplementation
		));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, perlEngineOwnedRefinementClosureImplementation, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, perlEngineOwnedRefinementClosureImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		"docs/type-surface.v1.json"
		, ...perlEngineOwnedRefinementClosureIntegrationPaths
	].sort());
	const record = {
		schemaVersion: 1
		, milestone: "perl-engine-owned-refinement-closure-source-v1"
		, predecessorCommit: perlEngineOwnedRefinementClosurePredecessor
		, implementationCommit: perlEngineOwnedRefinementClosureImplementation
		, reconciledTypeSurfacePointers: advanced
		, scope: "The filtered pinned Perl engine carries the complete owned-refinement model and carrier import closure before any package build begins."
		, updates, integrationUpdates, additions
	};
	await writeFile(perlEngineOwnedRefinementClosureHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(
		`Recorded ${updates.length} update, ${integrationUpdates.length} integrations, ${additions.length} additions and ${advanced} type-surface pointers.\n`
	);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
