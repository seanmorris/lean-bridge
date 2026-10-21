#!/usr/bin/env node
/**
 * Record the exact generic-Subtype composition transition.
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
	genericSubtypeCompositionChangedPaths
	, genericSubtypeCompositionHistoryPath
	, genericSubtypeCompositionImplementation
	, genericSubtypeCompositionPredecessor
	, reverseGenericSubtypeCompositionUpdate
} from "../tests/helpers/generic-subtype-composition-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, genericSubtypeCompositionImplementation
	, "Generic Subtype composition history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, genericSubtypeCompositionHistoryPath]).trim(), ""
, "Never rewrite committed generic Subtype composition history");

const addedPaths = Object.freeze([
	"scripts/update-generic-subtype-composition-source-history.mjs"
	, "tests/helpers/generic-subtype-composition-source-history.mjs"
	, "tests/helpers/generic-subtype-composition-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
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
			file.sha256 = actual; reconciled++;
		}
	}
assert.ok(reconciled > 0
	, "Type-surface reconciliation must advance live sources");
await writeFile(typeSurfacePath
	, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-generic-subtype-composition-history-"
));
const transition = async path => {
	const previous = git(["show"
		, `${genericSubtypeCompositionPredecessor}:${path}`]);
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
	assert.equal(reverseGenericSubtypeCompositionUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of genericSubtypeCompositionChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, genericSubtypeCompositionPredecessor, "--", path]).trim()
		, "", path);
		additions.push({
			path, currentSha256: sha256(await readFile(path))
		});
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, genericSubtypeCompositionImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		"docs/type-surface.v1.json"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/native-subtype.test.mjs"
	].sort());
	const record = {
		schemaVersion: 1
		, milestone: "generic-subtype-composition-source-v1"
		, predecessorCommit: genericSubtypeCompositionPredecessor
		, implementationCommit: genericSubtypeCompositionImplementation
		, reconciledTypeSurfacePointers: reconciled
		, scope: "Compiler, reviewed IR and generated-adapter history for per-use checked Subtype fields in alias-named generic records. Installed host acceptance and dependent generic fields remain pending."
		, updates, additions
	};
	await writeFile(genericSubtypeCompositionHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(
		`Recorded ${updates.length} updates and ${additions.length} additions.\n`
	);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
