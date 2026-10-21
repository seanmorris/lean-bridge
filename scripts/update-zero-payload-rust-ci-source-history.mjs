#!/usr/bin/env node
/**
 * Record the zero-payload Rust CI acceptance milestone.
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
	reverseZeroPayloadRustCiUpdate
	, zeroPayloadRustCiChangedPaths, zeroPayloadRustCiHistoryPath
	, zeroPayloadRustCiImplementation
	, zeroPayloadRustCiIntegrationPaths
	, zeroPayloadRustCiPredecessor
} from "../tests/helpers/zero-payload-rust-ci-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, zeroPayloadRustCiImplementation
	, "Zero-payload Rust CI history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadRustCiHistoryPath]).trim(), "");

const applicationAdditions = Object.freeze([
	".github/workflows/zero-payload-checked-record-rust.yml"
	, "scripts/check-zero-payload-checked-record-rust-ci.mjs"
	, "scripts/run-zero-payload-checked-record-rust-ci.sh"
	, "tests/helpers/zero-payload-checked-record-rust-ci-policy-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-rust-ci-report.mjs"
]);
const historyAdditions = Object.freeze([
	"scripts/update-zero-payload-rust-ci-source-history.mjs"
	, "tests/helpers/zero-payload-rust-ci-source-history.mjs"
	, "tests/helpers/zero-payload-rust-ci-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "zero-payload-rust-ci-history-"));
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
			, previous: previousLines.slice(
				previousStart, previousStart + previousCount
			).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount
			).join("")
		};
	});
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseZeroPayloadRustCiUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadRustCiChangedPaths)
		updates.push(await transition(path, zeroPayloadRustCiPredecessor));
	const integrationUpdates = [];
	for(const path of zeroPayloadRustCiIntegrationPaths)
		integrationUpdates.push(await transition(
			path, zeroPayloadRustCiImplementation
		));
	const additions = [];
	for(const path of applicationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadRustCiPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadRustCiImplementation, "--", path]
		).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadRustCiImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		...zeroPayloadRustCiIntegrationPaths
		, "tests/zero-payload-checked-record-rust.test.mjs"
	].sort());
	const record = {
		schemaVersion: 1, milestone: "zero-payload-rust-ci-source-v1"
		, predecessorCommit: zeroPayloadRustCiPredecessor
		, implementationCommit: zeroPayloadRustCiImplementation
		, reconciledTypeSurfacePointers: 0
		, scope: "Hosted Rust acceptance runs all four zero-payload author and API routes on Ubuntu 24.04 with pinned Rust 1.90, authenticates each record set independently, and retains complete and partial artifacts."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadRustCiHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, `
		+ `${integrationUpdates.length} integrations and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
