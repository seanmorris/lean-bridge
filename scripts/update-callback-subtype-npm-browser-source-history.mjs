#!/usr/bin/env node
/**
 * Record the exact npm/browser callback Subtype runtime transition. Reconcile
 * each type-surface evidence path with its actual bytes so live paths advance
 * while archived evidence retains the hashes of the bytes it executed.
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
	callbackSubtypeNpmBrowserChangedPaths
	, callbackSubtypeNpmBrowserHistoryPath
	, callbackSubtypeNpmBrowserImplementation
	, callbackSubtypeNpmBrowserPredecessor
	, reverseCallbackSubtypeNpmBrowserUpdate
} from "../tests/helpers/callback-subtype-npm-browser-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypeNpmBrowserImplementation
	, "Callback Subtype npm/browser history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypeNpmBrowserHistoryPath]).trim(), ""
, "Never rewrite committed callback Subtype npm/browser history");

const addedPaths = Object.freeze([
	"scripts/update-callback-subtype-npm-browser-source-history.mjs"
	, "tests/helpers/callback-subtype-npm-browser-source-history.mjs"
	, "tests/helpers/callback-subtype-npm-browser-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurfaceSources = Object.freeze([
	"src/abi/component-structured-callables.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/backends/javascript/package-audit.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/component-structured-callable-adapters.mjs"
	, "src/build/component-structured-callable-lean.mjs"
	, "src/release/component-callable-runtime.mjs"
	, "src/release/component-structured-callable-runtime.mjs"
	, "tests/component-structured-callable-contract.test.mjs"
]);

const sourceTransitions = new Map();
for(const path of callbackSubtypeNpmBrowserChangedPaths)
{
	if(path === typeSurfacePath) continue;
	const previous = git(["show"
		, `${callbackSubtypeNpmBrowserPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sourceTransitions.set(path, {
		previous: sha256(previous), current: sha256(current)
	});
}

const baselineTypeSurface = git(["show", `HEAD:${typeSurfacePath}`]);
const typeSurface = JSON.parse(baselineTypeSurface);
const selectiveTypeSurface = structuredClone(typeSurface);
for(const sourcePath of typeSurfaceSources)
{
	const transition = sourceTransitions.get(sourcePath);
	assert.ok(transition, sourcePath);
	let count = 0;
	for(const evidence of selectiveTypeSurface.evidence)
		for(const file of evidence.files)
			if(file.path === sourcePath && file.sha256 === transition.previous)
			{
				file.sha256 = transition.current;
				count++;
			}
	assert.ok(count > 0, `${typeSurfacePath}: ${sourcePath}`);
}
const selectiveTypeSurfaceText
	= JSON.stringify(selectiveTypeSurface, null, 2) + "\n";
const actualHashes = new Map();
let reconciled = 0;
for(const evidence of typeSurface.evidence)
	for(const file of evidence.files)
	{
		let actual = actualHashes.get(file.path);
		if(actual === undefined)
		{
			actual = sha256(await readFile(file.path));
			actualHashes.set(file.path, actual);
		}
		if(file.sha256 !== actual)
		{
			file.sha256 = actual;
			reconciled++;
		}
	}
assert.ok(reconciled > 0, "Type-surface reconciliation must change stale pointers");
const currentTypeSurface = JSON.stringify(typeSurface, null, 2) + "\n";
const existingTypeSurface = await readFile(typeSurfacePath, "utf8");
assert.ok(existingTypeSurface === baselineTypeSurface
	|| existingTypeSurface === selectiveTypeSurfaceText
	|| existingTypeSurface === currentTypeSurface
, `${typeSurfacePath} is neither baseline nor repaired`);
if(existingTypeSurface !== currentTypeSurface)
	await writeFile(typeSurfacePath, currentTypeSurface);
const pinContainers = [];

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-subtype-npm-browser-history-"
));
const transition = async path => {
	const previous = git(["show"
		, `${callbackSubtypeNpmBrowserPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
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
	assert.equal(reverseCallbackSubtypeNpmBrowserUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackSubtypeNpmBrowserChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackSubtypeNpmBrowserPredecessor, "--", path]).trim(), ""
		, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, callbackSubtypeNpmBrowserImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		typeSurfacePath
		, "tests/callback-subtype-extractor.test.mjs"
		, "tests/helpers/callback-subtype-foundation-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	].sort());
	const record = {
		schemaVersion: 1
		, milestone: "callback-subtype-npm-browser-source-v1"
		, predecessorCommit: callbackSubtypeNpmBrowserPredecessor
		, implementationCommit: callbackSubtypeNpmBrowserImplementation
		, updates, additions, pinContainers
	};
	await writeFile(callbackSubtypeNpmBrowserHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${additions.length} additions and ${pinContainers.length} repaired pointer containers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
