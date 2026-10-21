#!/usr/bin/env node
/**
 * Record the callback checked-record native C, C++ and Perl adapters as exact,
 * reversible transitions, including the refreshed type-surface pointers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	callbackCheckedRecordNativeChangedPaths
	, callbackCheckedRecordNativeHistoryPath
	, callbackCheckedRecordNativeImplementation
	, callbackCheckedRecordNativePredecessor
	, reverseCallbackCheckedRecordNativeUpdate
} from "../tests/helpers/callback-checked-record-native-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackCheckedRecordNativeImplementation
	, "Callback checked-record native history is draft-only at its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, callbackCheckedRecordNativePredecessor
	, "Callback checked-record native lane must retain its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackCheckedRecordNativeHistoryPath]).trim(), ""
, "Never rewrite committed callback checked-record native lane history");

const addedPaths = Object.freeze([
	".github/workflows/callback-checked-record-native.yml"
	, ".github/workflows/callback-checked-record-perl.yml"
	, "scripts/check-callback-checked-record-native-ci.mjs"
	, "scripts/check-callback-checked-record-perl-ci.mjs"
	, "scripts/run-callback-checked-record-native-ci.sh"
	, "scripts/run-callback-checked-record-perl-ci.sh"
	, "scripts/update-callback-checked-record-native-source-history.mjs"
	, "tests/callback-checked-record-native-ci.test.mjs"
	, "tests/callback-checked-record-native-installed.test.mjs"
	, "tests/callback-checked-record-native.test.mjs"
	, "tests/callback-checked-record-perl-installed.test.mjs"
	, "tests/fixtures/callback-checked-record-consumers/c.c"
	, "tests/fixtures/callback-checked-record-consumers/cpp.cpp"
	, "tests/fixtures/callback-checked-record-consumers/perl.pl"
	, "tests/helpers/callback-checked-record-native-ci.mjs"
	, "tests/helpers/callback-checked-record-native-source-history.mjs"
	, "tests/helpers/callback-checked-record-native-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const historyPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
// The native static test is an implementation addition that the history commit
// extends with its history-test import, like the lanes before it.
const historyEdits = Object.freeze([
	"tests/callback-checked-record-native.test.mjs"
]);

// Every changed source except the type-surface and the history-commit edits moves
// a pinned digest; the type-surface pointers follow those sources exactly.
const sourceTransitions = new Map();
for(const path of callbackCheckedRecordNativeChangedPaths)
{
	if(path === typeSurfacePath || historyPaths.includes(path)) continue;
	const previous = git(["show"
		, `${callbackCheckedRecordNativePredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sourceTransitions.set(path, {
		previous: sha256(previous), current: sha256(current)
	});
}
const pinContainers = [];
{
	const previous = git(["show", `HEAD:${typeSurfacePath}`]);
	let current = previous;
	const replacements = [];
	for(const [sourcePath, transition] of sourceTransitions)
	{
		const count = current.split(transition.previous).length - 1;
		if(count === 0) continue;
		current = current.replaceAll(transition.previous, transition.current);
		replacements.push({ sourcePath, ...transition, count });
	}
	assert.ok(replacements.length > 0
		, "Type-surface pointers must follow at least one changed source");
	const existing = await readFile(typeSurfacePath, "utf8");
	assert.ok(existing === previous || existing === current
		, `${typeSurfacePath} is neither baseline nor refreshed`);
	// Replace the pointer inventory atomically so a reader never sees a partial surface.
	if(existing === previous)
	{
		await writeFile(`${typeSurfacePath}.refreshed`, current);
		await rename(`${typeSurfacePath}.refreshed`, typeSurfacePath);
	}
	pinContainers.push({ path: typeSurfacePath
		, previousSha256: sha256(previous), currentSha256: sha256(current)
		, replacements });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-checked-record-history-"
));
const transition = async path => {
	const previous = git(["show"
		, `${callbackCheckedRecordNativePredecessor}:${path}`]);
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
	assert.equal(reverseCallbackCheckedRecordNativeUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackCheckedRecordNativeChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackCheckedRecordNativePredecessor, "--", path]).trim(), ""
		, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const implemented = git(["diff", "--name-only"
		, callbackCheckedRecordNativePredecessor
		, callbackCheckedRecordNativeImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(implemented, [
		...callbackCheckedRecordNativeChangedPaths.filter(path =>
			path !== typeSurfacePath && !historyPaths.includes(path))
		, ...addedPaths.filter(path => !path.includes("source-history"))
	].sort());
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, callbackCheckedRecordNativeImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [typeSurfacePath, ...historyPaths, ...historyEdits].sort());
	const record = {
		schemaVersion: 1
		, milestone: "callback-checked-record-native-source-v1"
		, predecessorCommit: callbackCheckedRecordNativePredecessor
		, implementationCommit: callbackCheckedRecordNativeImplementation
		, scope: "Checked records inside callbacks cross C, C++ and CPAN packages through the callable graph carrier: host replies need a typed record recovery, closure arguments run the exact record constructor with nested checked fields first, Lean-produced records cross as payload-only generated records, other native hosts stay refused at projection time, and independent C11/GMP, C++20 and Perl consumers with closed CI checkers prove it."
		, updates, additions, pinContainers
	};
	await writeFile(callbackCheckedRecordNativeHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${additions.length} additions and ${pinContainers.length} refreshed pointer containers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
