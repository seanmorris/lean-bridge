#!/usr/bin/env node
/**
 * Record the exact zero-payload Perl boolean-caller repair.
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
	reverseZeroPayloadPerlBooleanRepairUpdate
	, zeroPayloadPerlBooleanRepairChangedPaths
	, zeroPayloadPerlBooleanRepairHistoryPath
	, zeroPayloadPerlBooleanRepairImplementation
	, zeroPayloadPerlBooleanRepairImplementationPaths
	, zeroPayloadPerlBooleanRepairPredecessor
} from "../tests/helpers/zero-payload-perl-boolean-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, zeroPayloadPerlBooleanRepairImplementation
	, "Zero-payload Perl boolean history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadPerlBooleanRepairHistoryPath]).trim(), ""
, "Never rewrite committed zero-payload Perl boolean history");

for(const path of zeroPayloadPerlBooleanRepairImplementationPaths)
{
	const predecessor = git(["show"
		, `${zeroPayloadPerlBooleanRepairPredecessor}:${path}`]);
	const implementation = git(["show"
		, `${zeroPayloadPerlBooleanRepairImplementation}:${path}`]);
	assert.notEqual(implementation, predecessor, path);
	assert.equal(await readFile(path, "utf8"), implementation, path);
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-zero-payload-perl-boolean-history-"
));
const transition = async path => {
	const previous = git(["show"
		, `${zeroPayloadPerlBooleanRepairPredecessor}:${path}`]);
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
	assert.equal(reverseZeroPayloadPerlBooleanRepairUpdate(
		current, update), previous);
	return update;
};

const addedPaths = Object.freeze([
	"scripts/update-zero-payload-perl-boolean-repair-source-history.mjs"
	, "tests/helpers/zero-payload-perl-boolean-repair-source-history.mjs"
	, "tests/helpers/zero-payload-perl-boolean-repair-source-history-tests.mjs"
]);
try
{
	const updates = [];
	for(const path of zeroPayloadPerlBooleanRepairChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadPerlBooleanRepairImplementation, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadPerlBooleanRepairImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/zero-payload-checked-record-perl.test.mjs"
	].sort());
	const record = {
		schemaVersion: 1
		, milestone: "zero-payload-perl-boolean-repair-source-v1"
		, predecessorCommit: zeroPayloadPerlBooleanRepairPredecessor
		, implementationCommit: zeroPayloadPerlBooleanRepairImplementation
		, implementationPaths: zeroPayloadPerlBooleanRepairImplementationPaths
		, scope: "The independent Perl consumer obtains canonical booleans from each installed generated package before calling Bool-parameter APIs; plain scalar 0 and 1 are not substituted for the public boolean carrier."
		, updates, additions
	};
	await writeFile(zeroPayloadPerlBooleanRepairHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(
		`Recorded ${updates.length} updates and ${additions.length} additions.\n`
	);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
