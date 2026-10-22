#!/usr/bin/env node
/**
 * Record the owned checked-record source foundation as exact, reversible
 * transitions, including the refreshed type-surface pointers.
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
	ownedCheckedRecordFoundationChangedPaths
	, ownedCheckedRecordFoundationHistoryPath
	, ownedCheckedRecordFoundationImplementation
	, ownedCheckedRecordFoundationPredecessor
	, reverseOwnedCheckedRecordFoundationUpdate
} from "../tests/helpers/owned-checked-record-foundation-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedCheckedRecordFoundationImplementation
	, "Owned checked-record foundation history is draft-only at its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, ownedCheckedRecordFoundationPredecessor
	, "Owned checked-record foundation must retain its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedCheckedRecordFoundationHistoryPath]).trim(), ""
, "Never rewrite committed owned checked-record foundation lane history");

const addedPaths = Object.freeze([
	"scripts/update-owned-checked-record-foundation-source-history.mjs"
	, "tests/fixtures/onboarding/owned-checked-records/OwnedCheckedRecords.lean"
	, "tests/fixtures/onboarding/owned-checked-records/lakefile.toml"
	, "tests/fixtures/onboarding/owned-checked-records/lean-toolchain"
	, "tests/helpers/owned-checked-record-fixture.mjs"
	, "tests/helpers/owned-checked-record-foundation-source-history.mjs"
	, "tests/helpers/owned-checked-record-foundation-source-history-tests.mjs"
	, "tests/owned-checked-record-foundation.test.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const historyPaths = Object.freeze([
	"tests/helpers/dependent-record-constructor-authority-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
// The foundation test is an implementation addition that the history commit
// extends with its history-test import, like the lanes before it.
const historyEdits = Object.freeze([
	"tests/owned-checked-record-foundation.test.mjs"
]);

// Every changed source except the type-surface and the history-commit edits moves
// a pinned digest; the type-surface pointers follow those sources exactly.
const sourceTransitions = new Map();
for(const path of ownedCheckedRecordFoundationChangedPaths)
{
	if(path === typeSurfacePath || historyPaths.includes(path)) continue;
	const previous = git(["show"
		, `${ownedCheckedRecordFoundationPredecessor}:${path}`]);
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
	tmpdir(), "lean-bridge-owned-checked-record-history-"
));
const transition = async path => {
	const previous = git(["show"
		, `${ownedCheckedRecordFoundationPredecessor}:${path}`]);
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
	assert.equal(reverseOwnedCheckedRecordFoundationUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedCheckedRecordFoundationChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedCheckedRecordFoundationPredecessor, "--", path]).trim(), ""
		, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const implemented = git(["diff", "--name-only"
		, ownedCheckedRecordFoundationPredecessor
		, ownedCheckedRecordFoundationImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(implemented, [
		...ownedCheckedRecordFoundationChangedPaths.filter(path =>
			path !== typeSurfacePath && !historyPaths.includes(path))
		, ...addedPaths.filter(path => !path.includes("source-history"))
	].sort());
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, ownedCheckedRecordFoundationImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [typeSurfacePath, ...historyPaths, ...historyEdits].sort());
	const record = {
		schemaVersion: 1
		, milestone: "owned-checked-record-foundation-source-v1"
		, predecessorCommit: ownedCheckedRecordFoundationPredecessor
		, implementationCommit: ownedCheckedRecordFoundationImplementation
		, scope: "Checked records compose with owned aggregates at the source level: reviewed owned contracts name a record's erased proofs and every consumed occurrence names its exact constructor, owned checked-record trees pass only behind the explicit ownership-aware boundary, owned compiler graphs carry erased proof names on their record definitions and validate them as nominal transports, and owned adapters run the constructor before any lease moves while produced records keep their resource identity."
		, updates, additions, pinContainers
	};
	await writeFile(ownedCheckedRecordFoundationHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${additions.length} additions and ${pinContainers.length} refreshed pointer containers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
