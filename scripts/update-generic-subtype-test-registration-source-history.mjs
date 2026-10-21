#!/usr/bin/env node
/**
 * Record the generic-Subtype host-suite registration repair.
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
	genericSubtypeTestRegistrationAddedTests
	, genericSubtypeTestRegistrationChangedPaths
	, genericSubtypeTestRegistrationHistoryPath
	, genericSubtypeTestRegistrationImplementation
	, genericSubtypeTestRegistrationIntegrationPaths
	, genericSubtypeTestRegistrationPredecessor
	, reverseGenericSubtypeTestRegistrationUpdate
} from "../tests/helpers/generic-subtype-test-registration-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const implementation = git(["rev-parse", genericSubtypeTestRegistrationImplementation]).trim();
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Generic Subtype test registration history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, genericSubtypeTestRegistrationHistoryPath]).trim(), "");

const additions = Object.freeze([
	"scripts/update-generic-subtype-test-registration-source-history.mjs"
	, "tests/helpers/generic-subtype-test-registration-source-history.mjs"
	, "tests/helpers/generic-subtype-test-registration-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(tmpdir(), "lean-generic-subtype-registration-history-"));
const transition = async (path, revision) => {
	const previous = git(["show", `${revision}:${path}`]);
	const current = await readFile(path, "utf8");
	const previousPath = join(directory, "previous"), currentPath = join(directory, "current");
	await writeFile(previousPath, previous); await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = git(["diff", "--histogram", "--no-index", "--no-ext-diff"
			, "--no-textconv", "--no-color", "--unified=0", previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u), currentLines = current.split(/(?<=\n)/u);
	const edits = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)]
		.map(match => {
			const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
			const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
			const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
			return { start: currentLines.slice(0, currentStart).join("").length
				, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
		});
	const update = { path, previousSha256: sha256(previous), currentSha256: sha256(current), edits };
	assert.ok(edits.length > 0, path);
	assert.equal(reverseGenericSubtypeTestRegistrationUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of genericSubtypeTestRegistrationChangedPaths)
		updates.push(await transition(path, genericSubtypeTestRegistrationPredecessor));
	const integrationUpdates = [];
	for(const path of genericSubtypeTestRegistrationIntegrationPaths)
		integrationUpdates.push(await transition(path, implementation));
	for(const path of additions)
		assert.equal(git(["ls-tree", "--name-only", genericSubtypeTestRegistrationPredecessor, "--", path]).trim(), "", path);
	const modified = git(["diff", "--name-only", "--diff-filter=M", implementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [...genericSubtypeTestRegistrationIntegrationPaths].sort());
	const oldProfile = updates.find(item => item.path === "src/adoption/test-profiles.mjs");
	const inventory = updates.find(item => item.path === "docs/type-surface.v1.json");
	const oldDigest = oldProfile.previousSha256, newDigest = oldProfile.currentSha256;
	const previousInventory = git(["show", `${genericSubtypeTestRegistrationPredecessor}:docs/type-surface.v1.json`]);
	const pinCount = previousInventory.split(oldDigest).length - 1;
	assert.equal(pinCount, 94);
	assert.equal((await readFile("docs/type-surface.v1.json", "utf8")).split(newDigest).length - 1, pinCount);
	assert.ok(inventory.edits.length > 0);
	await writeFile(genericSubtypeTestRegistrationHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "generic-subtype-test-registration-source-v1"
		, predecessorCommit: genericSubtypeTestRegistrationPredecessor
		, implementationCommit: implementation
		, addedTests: genericSubtypeTestRegistrationAddedTests
		, pinCount, updates, integrationUpdates
		, additions: await Promise.all(additions.map(async path => ({ path, currentSha256: sha256(await readFile(path)) })))
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} registration updates, ${integrationUpdates.length} integrations and ${pinCount} inventory pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
