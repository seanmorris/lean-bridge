#!/usr/bin/env node
/**
 * Record the exact remaining-host callback Subtype installed-acceptance gate.
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
	callbackSubtypeRemainingAcceptanceChangedPaths
	, callbackSubtypeRemainingAcceptanceHistoryPath
	, callbackSubtypeRemainingAcceptanceImplementation
	, callbackSubtypeRemainingAcceptancePredecessor
	, reverseCallbackSubtypeRemainingAcceptanceUpdate
} from "../tests/helpers/callback-subtype-remaining-acceptance-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypeRemainingAcceptanceImplementation
	, "Remaining callback Subtype acceptance history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypeRemainingAcceptanceHistoryPath]).trim(), ""
, "Never rewrite committed remaining callback Subtype acceptance history");

const addedPaths = Object.freeze([
	".github/workflows/callback-subtype-remaining.yml"
	, "scripts/check-callback-subtype-remaining-ci.mjs"
	, "scripts/run-callback-subtype-remaining-ci.sh"
	, "scripts/update-callback-subtype-remaining-acceptance-source-history.mjs"
	, "tests/callback-subtype-remaining-installed.test.mjs"
	, "tests/fixtures/callback-subtype-consumers/dotnet.cs"
	, "tests/fixtures/callback-subtype-consumers/java.java"
	, "tests/fixtures/callback-subtype-consumers/kotlin.kt"
	, "tests/fixtures/callback-subtype-consumers/php-native.php"
	, "tests/fixtures/callback-subtype-consumers/wit-wasi.c"
	, "tests/helpers/callback-subtype-jvm-install.mjs"
	, "tests/helpers/callback-subtype-remaining-acceptance-source-history.mjs"
	, "tests/helpers/callback-subtype-remaining-acceptance-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-wit-install.mjs"
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
assert.ok(reconciled > 0, "Type-surface reconciliation must advance live sources");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");
const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-subtype-remaining-acceptance-history-"
));
const transition = async path => {
	const previous = git(["show"
		, `${callbackSubtypeRemainingAcceptancePredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous); await writeFile(currentPath, current);
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
	assert.equal(reverseCallbackSubtypeRemainingAcceptanceUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackSubtypeRemainingAcceptanceChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackSubtypeRemainingAcceptancePredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, callbackSubtypeRemainingAcceptanceImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		"docs/type-surface.v1.json"
		, "tests/helpers/callback-subtype-language-source-history-tests.mjs"
		, "tests/helpers/callback-subtype-remaining-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	].sort());
	const record = {
		schemaVersion: 1
		, milestone: "callback-subtype-remaining-acceptance-source-v1"
		, predecessorCommit: callbackSubtypeRemainingAcceptancePredecessor
		, implementationCommit: callbackSubtypeRemainingAcceptanceImplementation
		, reconciledTypeSurfacePointers: reconciled
		, scope: "Source and contract history for ordinary and reviewed .NET, Java, Kotlin, native PHP and WIT/WASI installed callback Subtype gates. Hosted execution and promotion remain pending."
		, updates, additions
	};
	await writeFile(callbackSubtypeRemainingAcceptanceHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
