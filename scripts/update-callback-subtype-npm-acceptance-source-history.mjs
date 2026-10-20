#!/usr/bin/env node
/**
 * Record callback Subtype npm acceptance and reconcile every type-surface
 * evidence path with the bytes it actually names.
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
	callbackSubtypeNpmAcceptanceChangedPaths
	, callbackSubtypeNpmAcceptanceHistoryPath
	, callbackSubtypeNpmAcceptanceImplementation
	, callbackSubtypeNpmAcceptancePredecessor
	, reverseCallbackSubtypeNpmAcceptanceUpdate
} from "../tests/helpers/callback-subtype-npm-acceptance-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypeNpmAcceptanceImplementation
	, "Callback Subtype npm acceptance history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypeNpmAcceptanceHistoryPath]).trim(), ""
, "Never rewrite committed callback Subtype npm acceptance history");

const addedPaths = Object.freeze([
	"scripts/update-callback-subtype-npm-acceptance-source-history.mjs"
	, "tests/callback-subtype-npm-browser.test.mjs"
	, "tests/fixtures/callback-subtype-consumers/javascript.mjs"
	, "tests/fixtures/callback-subtype-consumers/types.mts"
	, "tests/fixtures/onboarding/callback-subtypes/LICENSE"
	, "tests/fixtures/onboarding/callback-subtypes/lakefile.toml"
	, "tests/fixtures/onboarding/callback-subtypes/lean-toolchain"
	, "tests/fixtures/onboarding/callback-subtypes/package.json"
	, "tests/helpers/callback-subtype-fixture.mjs"
	, "tests/helpers/callback-subtype-npm-acceptance-source-history.mjs"
	, "tests/helpers/callback-subtype-npm-acceptance-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";

const baselineTypeSurface = git(["show", `HEAD:${typeSurfacePath}`]);
const typeSurface = JSON.parse(baselineTypeSurface);
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
assert.ok(reconciled > 0, "Type-surface reconciliation must advance live sources");
const currentTypeSurface = JSON.stringify(typeSurface, null, 2) + "\n";
const existingTypeSurface = await readFile(typeSurfacePath, "utf8");
assert.ok(existingTypeSurface === baselineTypeSurface
	|| existingTypeSurface === currentTypeSurface
, `${typeSurfacePath} is neither baseline nor reconciled`);
if(existingTypeSurface === baselineTypeSurface)
	await writeFile(typeSurfacePath, currentTypeSurface);

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-subtype-npm-acceptance-history-"
));
const transition = async path => {
	const previous = git(["show"
		, `${callbackSubtypeNpmAcceptancePredecessor}:${path}`]);
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
	assert.equal(reverseCallbackSubtypeNpmAcceptanceUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackSubtypeNpmAcceptanceChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackSubtypeNpmAcceptancePredecessor, "--", path]).trim(), ""
		, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, callbackSubtypeNpmAcceptanceImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		typeSurfacePath
		, "tests/callback-subtype-npm-browser.test.mjs"
		, "tests/helpers/callback-subtype-foundation-source-history-tests.mjs"
		, "tests/helpers/callback-subtype-npm-browser-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	].sort());
	const record = {
		schemaVersion: 1
		, milestone: "callback-subtype-npm-acceptance-source-v1"
		, predecessorCommit: callbackSubtypeNpmAcceptancePredecessor
		, implementationCommit: callbackSubtypeNpmAcceptanceImplementation
		, updates, additions
	};
	await writeFile(callbackSubtypeNpmAcceptanceHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
