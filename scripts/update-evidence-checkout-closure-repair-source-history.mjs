#!/usr/bin/env node
/**
 * Record the exact evidence-checkout and npm entry-probe repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	evidenceCheckoutClosureRepairAddedPaths
	, evidenceCheckoutClosureRepairCommits
	, evidenceCheckoutClosureRepairHistoryPath
	, evidenceCheckoutClosureRepairImplementation
	, evidenceCheckoutClosureRepairImplementationAdditions
	, evidenceCheckoutClosureRepairImplementationPaths
	, evidenceCheckoutClosureRepairIntegrationPaths
	, evidenceCheckoutClosureRepairModifiedPaths
	, evidenceCheckoutClosureRepairPredecessor
	, reverseEvidenceCheckoutClosureRepairUpdate
} from "../tests/helpers/evidence-checkout-closure-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const gitBytes = arguments_ => execFileSync("git", arguments_, {
	maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const implementation = evidenceCheckoutClosureRepairImplementation;
const predecessor = evidenceCheckoutClosureRepairPredecessor;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Evidence checkout closure history requires its implementation commit");
assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, evidenceCheckoutClosureRepairCommits);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...evidenceCheckoutClosureRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...evidenceCheckoutClosureRepairModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, [...evidenceCheckoutClosureRepairImplementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${evidenceCheckoutClosureRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...evidenceCheckoutClosureRepairIntegrationPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-evidence-checkout-closure-history-"));
const transition = async (path, previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
			, previousPath, currentPath], {
			encoding: "utf8", maxBuffer: 512 * 1024 * 1024
			}
		);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const offsets = [0];
	for(const line of currentLines) offsets.push(offsets.at(-1) + line.length);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: offsets[currentStart]
			, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart, currentStart + currentCount).join("")
		};
	});
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current), edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseEvidenceCheckoutClosureRepairUpdate(current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of evidenceCheckoutClosureRepairModifiedPaths)
		updates.push(await transition(path, source(predecessor, path), source(implementation, path)));
	const implementationAdditions = [];
	for(const path of evidenceCheckoutClosureRepairImplementationAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e", `${predecessor}:${path}`]
			, { stdio: "ignore" }).status, 0, path);
		implementationAdditions.push({
			path, currentSha256: sha256(gitBytes(["show", `${implementation}:${path}`]))
		});
	}
	const integrationUpdates = [];
	for(const path of evidenceCheckoutClosureRepairIntegrationPaths)
		integrationUpdates.push(await transition(path, source(implementation, path)
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of evidenceCheckoutClosureRepairAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e", `${implementation}:${path}`]
			, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(evidenceCheckoutClosureRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "evidence-checkout-closure-repair-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, implementationCommits: evidenceCheckoutClosureRepairCommits
		, scope: "Keep every indexed evidence log in Git, prevent ignored local artifacts from masking incomplete checkouts, and inspect the npm entry probe at the published internal/wasm package location."
		, implementationAdditions, updates, additions, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, `
		+ `${implementationAdditions.length} implementation additions, `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
