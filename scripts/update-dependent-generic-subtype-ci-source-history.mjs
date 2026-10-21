#!/usr/bin/env node
/**
 * Record the dependent generic-Subtype recurring-CI transition.
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
	dependentGenericSubtypeCiChangedPaths
	, dependentGenericSubtypeCiHistoryPath
	, dependentGenericSubtypeCiImplementation
	, dependentGenericSubtypeCiIntegrationPaths
	, dependentGenericSubtypeCiPredecessor
	, reverseDependentGenericSubtypeCiUpdate
} from "../tests/helpers/dependent-generic-subtype-ci-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const implementation = git(["rev-parse"
	, dependentGenericSubtypeCiImplementation]).trim();
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Dependent generic Subtype CI history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, dependentGenericSubtypeCiHistoryPath]).trim(), "");
const additions = Object.freeze([
	"scripts/update-dependent-generic-subtype-ci-source-history.mjs"
	, "tests/helpers/dependent-generic-subtype-ci-source-history.mjs"
	, "tests/helpers/dependent-generic-subtype-ci-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-generic-subtype-ci-history-"
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
	assert.equal(reverseDependentGenericSubtypeCiUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of dependentGenericSubtypeCiChangedPaths)
		updates.push(await transition(path, dependentGenericSubtypeCiPredecessor));
	const integrationUpdates = [];
	for(const path of dependentGenericSubtypeCiIntegrationPaths)
		integrationUpdates.push(await transition(path, implementation));
	for(const path of additions)
		assert.equal(git(["ls-tree", "--name-only"
			, dependentGenericSubtypeCiPredecessor, "--", path]).trim(), "", path);
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, implementation, "--"]).trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [...dependentGenericSubtypeCiIntegrationPaths].sort());
	await writeFile(dependentGenericSubtypeCiHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "dependent-generic-subtype-ci-source-v1"
		, predecessorCommit: dependentGenericSubtypeCiPredecessor
		, implementationCommit: implementation
		, scope: "Recurring exact-revision fresh-Lean extraction, independent-review reconciliation, native adapter compilation, static contracts, reversible history and JavaScript typechecking for dependent generic checked Subtypes."
		, updates, integrationUpdates
		, additions: await Promise.all(additions.map(async path => ({
			path, currentSha256: sha256(await readFile(path))
		})))
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} CI update and ${integrationUpdates.length} integrations.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
