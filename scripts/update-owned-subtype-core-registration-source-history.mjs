#!/usr/bin/env node
/**
 * Record the exact owned-Subtype Core profile registration repair.
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
	ownedSubtypeCoreRegistrationChangedPaths
	, ownedSubtypeCoreRegistrationHistoryPath
	, ownedSubtypeCoreRegistrationImplementation
	, ownedSubtypeCoreRegistrationPredecessor
	, ownedSubtypeCoreRegistrationTests
	, reverseOwnedSubtypeCoreRegistrationUpdate
} from "../tests/helpers/owned-subtype-core-registration-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedSubtypeCoreRegistrationImplementation
	, "Owned Subtype Core registration history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedSubtypeCoreRegistrationHistoryPath]).trim(), ""
, "Never rewrite committed owned Subtype Core registration history");

const addedPaths = Object.freeze([
	"scripts/update-owned-subtype-core-registration-source-history.mjs"
	, "tests/helpers/owned-subtype-core-registration-source-history.mjs"
	, "tests/helpers/owned-subtype-core-registration-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const typeSurfaceSourcePaths = Object.freeze([
	...ownedSubtypeCoreRegistrationChangedPaths
	, "tests/component-array-contract.test.mjs"
]);
const actualHashes = new Map();
for(const path of typeSurfaceSourcePaths)
	actualHashes.set(path, sha256(await readFile(path)));
let advanced = 0;
for(const evidence of typeSurface.evidence)
	for(const file of evidence.files)
	{
		const actual = actualHashes.get(file.path);
		if(actual !== undefined && file.sha256 !== actual)
		{
			file.sha256 = actual; advanced++;
		}
	}
assert.ok(advanced > 0
	, "Type-surface reconciliation must advance live registration sources");
await writeFile(typeSurfacePath
	, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-owned-subtype-core-registration-history-"
));
const transition = async path => {
	const previous = git(["show"
		, `${ownedSubtypeCoreRegistrationPredecessor}:${path}`]);
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
	if(path === "src/adoption/test-profiles.mjs")
		update.addedTests = ownedSubtypeCoreRegistrationTests;
	assert.equal(reverseOwnedSubtypeCoreRegistrationUpdate(current, update)
		, previous);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedSubtypeCoreRegistrationChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedSubtypeCoreRegistrationPredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, ownedSubtypeCoreRegistrationImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		"docs/type-surface.v1.json"
		, "tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	].sort());
	const record = {
		schemaVersion: 1
		, milestone: "owned-subtype-core-registration-source-v1"
		, predecessorCommit: ownedSubtypeCoreRegistrationPredecessor
		, implementationCommit: ownedSubtypeCoreRegistrationImplementation
		, reconciledTypeSurfacePointers: advanced
		, scope: "Closed Core profile registration for every owned-Subtype package and registration-history root test."
		, updates, additions
	};
	await writeFile(ownedSubtypeCoreRegistrationHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(
		`Recorded ${updates.length} updates and ${additions.length} additions.\n`
	);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
