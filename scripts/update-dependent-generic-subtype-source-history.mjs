#!/usr/bin/env node
/**
 * Record the dependent generic-Subtype compiler/review transition.
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
	dependentGenericSubtypeChangedPaths
	, dependentGenericSubtypeHistoryPath
	, dependentGenericSubtypeImplementation
	, dependentGenericSubtypeIntegrationPaths
	, dependentGenericSubtypePinnedPaths
	, dependentGenericSubtypePredecessor
	, reverseDependentGenericSubtypeUpdate
} from "../tests/helpers/dependent-generic-subtype-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const implementation = git(["rev-parse"
	, dependentGenericSubtypeImplementation]).trim();
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Dependent generic Subtype history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, dependentGenericSubtypeHistoryPath]).trim(), ""
, "Never rewrite committed dependent generic Subtype history");

const additions = Object.freeze([
	"scripts/update-dependent-generic-subtype-source-history.mjs"
	, "tests/helpers/dependent-generic-subtype-source-history.mjs"
	, "tests/helpers/dependent-generic-subtype-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-generic-subtype-history-"
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
	assert.equal(reverseDependentGenericSubtypeUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of dependentGenericSubtypeChangedPaths)
		updates.push(await transition(path, dependentGenericSubtypePredecessor));
	const integrationUpdates = [];
	for(const path of dependentGenericSubtypeIntegrationPaths)
		integrationUpdates.push(await transition(path, implementation));
	for(const path of additions)
		assert.equal(git(["ls-tree", "--name-only"
			, dependentGenericSubtypePredecessor, "--", path]).trim(), "", path);
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, implementation, "--"]).trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [...dependentGenericSubtypeIntegrationPaths].sort());
	const previousInventory = JSON.parse(git(["show"
		, `${dependentGenericSubtypePredecessor}:docs/type-surface.v1.json`]));
	const currentInventory = JSON.parse(await readFile(
		"docs/type-surface.v1.json", "utf8"));
	const pins = (value, path, digest) => {
		if(!value || typeof value !== "object") return 0;
		const own = !Array.isArray(value) && value.path === path
			&& value.sha256 === digest ? 1 : 0;
		return own + Object.values(value).reduce((sum, child) =>
			sum + pins(child, path, digest), 0);
	};
	let pinCount = 0;
	for(const path of dependentGenericSubtypePinnedPaths)
	{
		const previousDigest = sha256(git(["show"
			, `${dependentGenericSubtypePredecessor}:${path}`]));
		const currentDigest = sha256(await readFile(path));
		const count = pins(previousInventory, path, previousDigest);
		assert.ok(count > 0, path);
		assert.equal(pins(currentInventory, path, currentDigest), count, path);
		pinCount += count;
	}
	assert.equal(pinCount, 478);
	await writeFile(dependentGenericSubtypeHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "dependent-generic-subtype-source-v1"
		, predecessorCommit: dependentGenericSubtypePredecessor
		, implementationCommit: implementation
		, pinCount
		, scope: "Compiler and independently reviewed top-level generic checked records with retained Nat, Bool and String indices, erased proofs, synthesized instance dictionaries and per-specialization Subtype constructors. Installed host promotion remains separate."
		, updates, integrationUpdates
		, additions: await Promise.all(additions.map(async path => ({
			path, currentSha256: sha256(await readFile(path))
		})))
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation updates, ${integrationUpdates.length} integrations and ${pinCount} inventory pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
